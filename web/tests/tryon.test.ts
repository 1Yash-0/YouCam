import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createPipelineTryonService, PipelineDeps } from '@/lib/tryon-pipeline'
import { createStorage } from '@/lib/storage'
import { AppError, ErrorCodes } from '@/lib/errors'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

describe('unified try-on pipeline', () => {
  let root: string
  let storage: ReturnType<typeof createStorage>
  let service: ReturnType<typeof createPipelineTryonService>
  let createTask: ReturnType<typeof vi.fn>
  let getTask: ReturnType<typeof vi.fn>
  let uploadFile: ReturnType<typeof vi.fn>
  let fetchBytes: ReturnType<typeof vi.fn>
  let assertCanSpend: ReturnType<typeof vi.fn>
  let recordSpend: ReturnType<typeof vi.fn>
  let measure: ReturnType<typeof vi.fn>
  let uploadInputs: Buffer[]
  let taskNumber: number

  const products: Record<string, any> = {
    'gilded-teardrop': { product: { id: 'gilded-teardrop', type: 'single', heightCm: 3 }, fileId: 'ear-file' },
    'orb-chain': { product: { id: 'orb-chain', type: 'necklace', lengthCm: 40 }, fileId: 'neck-file' },
    'emerald-blouse': { product: { id: 'emerald-blouse', type: 'garment', garmentCategory: 'upper_body' }, fileId: 'cloth-file' },
    'gold-band': { product: { id: 'gold-band', type: 'ring', diameterMm: 20 }, fileId: 'ring-file' },
    'thin-cuff': { product: { id: 'thin-cuff', type: 'bracelet', diameterMm: 64, widthMm: 4 }, fileId: 'bracelet-file' },
    'gold-dress-watch': { product: { id: 'gold-dress-watch', type: 'watch', caseMm: 36, lugToLugMm: 42, watchSource: { width: 1104, height: 1472, x: 552, strapBegin: 40, caseTop: 170, caseBottom: 1320, strapEnd: 1440 } }, fileId: 'watch-file' },
  }

  async function addPhoto(id = 'photo-1', bytes = PNG) {
    await storage.putFile(storage.photoPath(id), bytes)
    await storage.putJson(storage.photoMetaPath(id), { fileId: `${id}-file`, uploadedAt: new Date().toISOString(), width: 1, height: 1 })
  }
  async function finish(request: any, visitor = 'visitor') {
    const created = await service.createPipelineTryOnJob(request, visitor)
    if (created.status === 'done') return created.result
    let current: any
    for (let i = 0; i < 30; i++) {
      current = await service.checkPipelineJobStatus(created.jobId)
      if (current.status === 'done' || current.status === 'error') return current
    }
    throw new Error('job did not finish')
  }
  function baseRequest(extra: any = {}) { return { photoId: 'photo-1', productId: 'gilded-teardrop', sizeCm: 3, ...extra } }

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'darpan-pipeline-'))
    storage = createStorage({ rootDir: root })
    createTask = vi.fn(async () => `task-${++taskNumber}`)
    getTask = vi.fn(async (_feature: string, taskId: string) => ({ status: 'success' as const, resultUrl: `https://${taskId}.png`, raw: {} }))
    uploadInputs = []
    uploadFile = vi.fn(async (bytes: Buffer) => { uploadInputs.push(bytes); return `output-file-${uploadInputs.length}` })
    fetchBytes = vi.fn(async () => PNG)
    assertCanSpend = vi.fn(async () => undefined)
    recordSpend = vi.fn(async () => undefined)
    measure = vi.fn(async () => ({ renderedPx: 30, renderedCm: 3 }))
    taskNumber = 0
    await addPhoto()
    const deps: PipelineDeps = {
      youcam: { uploadFile, createTask, getTask }, fetchBytes, storage,
      guard: { assertCanSpend, recordSpend },
      products: { getProductWithFileId: vi.fn(async (id: string) => products[id] || null) },
      measure, now: () => new Date('2025-01-01T00:00:00Z'), uuid: vi.fn(() => `job-${Math.random()}`),
    }
    service = createPipelineTryonService(deps)
  })
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('runs a plain ear request as exactly one step', async () => {
    const result = await finish(baseRequest(), 'v1')
    expect(result.status).toBe('done')
    if (result.status === 'done') expect(result.result.steps).toEqual([{ type: 'earring', units: 1, cached: false }])
    expect(createTask).toHaveBeenCalledTimes(1)
    expect(assertCanSpend).toHaveBeenCalledWith('v1', 1)
    expect(recordSpend).toHaveBeenCalledTimes(1)
  })

  it('never resubmits a task interrupted during provider submission', async () => {
    const created = await service.createPipelineTryOnJob(baseRequest(), 'uncertain')
    if (created.status !== 'running') throw new Error('Expected new job')
    const key = storage.pipelineJobPath(created.jobId)
    const job = await storage.getJson<any>(key)
    job.steps[0].status = 'submitting'
    await storage.putJson(key, job)
    const result = await service.checkPipelineJobStatus(created.jobId)
    expect(result).toMatchObject({ status: 'error', code: 'SUBMISSION_UNCERTAIN' })
    expect(createTask).not.toHaveBeenCalled()
  })

  it('does not turn a stack difference box into a single-piece size verdict', async () => {
    await finish(baseRequest({ stack: [{ productId: 'gilded-teardrop', sizeCm: 3, wearingLocation: [100, 200] }] }))
    expect(measure).not.toHaveBeenCalled()
  })

  it('isolates private cache outputs between separate uploaded photos', async () => {
    for (const id of ['private-a', 'private-b']) {
      await addPhoto(id)
      const key = storage.photoMetaPath(id)
      await storage.putJson(key, { ...(await storage.getJson<any>(key)), ownerId: 'same-owner', expiresAt: '2030-01-01T00:00:00Z' })
    }
    await finish(baseRequest({ photoId: 'private-a' }))
    await finish(baseRequest({ photoId: 'private-b' }))
    expect(createTask).toHaveBeenCalledTimes(2)
  })

  it('makes a cache hit with zero task calls and zero units', async () => {
    await finish(baseRequest(), 'v1')
    const calls = createTask.mock.calls.length
    const cached = await service.createPipelineTryOnJob(baseRequest(), 'v2')
    expect(cached.status).toBe('done')
    if (cached.status === 'done') {
      expect(cached.result.unitsSpent).toBe(0)
      expect(cached.result.steps[0].cached).toBe(true)
    }
    expect(createTask).toHaveBeenCalledTimes(calls)
    expect(assertCanSpend).toHaveBeenCalledTimes(1)
  })

  it('records spend once when concurrent polls observe success', async () => {
    const created = await service.createPipelineTryOnJob(baseRequest(), 'concurrent')
    if (created.status !== 'running') throw new Error('expected running')
    await service.checkPipelineJobStatus(created.jobId)
    const results = await Promise.all([service.checkPipelineJobStatus(created.jobId), service.checkPipelineJobStatus(created.jobId), service.checkPipelineJobStatus(created.jobId)])
    expect(results.every(result => result.status === 'done')).toBe(true)
    expect(getTask).toHaveBeenCalledTimes(1)
    expect(recordSpend).toHaveBeenCalledTimes(1)
  })

  it('retries the other ear only when ear is not pinned', async () => {
    getTask.mockResolvedValueOnce({ status: 'error', errorMessage: 'earlobe alignment not confident', raw: {} })
    getTask.mockResolvedValueOnce({ status: 'success', resultUrl: 'https://retry.png', raw: {} })
    const created = await service.createPipelineTryOnJob(baseRequest(), 'retry')
    if (created.status !== 'running') throw new Error('expected running')
    await service.checkPipelineJobStatus(created.jobId)
    const retryPending = await service.checkPipelineJobStatus(created.jobId)
    expect(retryPending).toMatchObject({ status: 'running', step: 'earring' })
    await service.checkPipelineJobStatus(created.jobId)
    await service.checkPipelineJobStatus(created.jobId)
    expect(createTask).toHaveBeenCalledTimes(2)
    expect(createTask.mock.calls[1][1].object_infos[0].parameter.earring_is_right_ear).toBe(false)
  })

  it('does not retry a pinned ear', async () => {
    getTask.mockResolvedValueOnce({ status: 'error', errorMessage: 'earlobe alignment not confident', raw: {} })
    const result = await finish(baseRequest({ ear: 'right' }), 'pinned')
    expect(result).toMatchObject({ status: 'error', code: ErrorCodes.EAR_NOT_VISIBLE })
    expect(createTask).toHaveBeenCalledTimes(1)
  })

  it('plans ear plus lipstick as makeup followed by earring', async () => {
    const result = await finish(baseRequest({ options: { lipstick: { hex: '#9B1B30', texture: 'matte', intensity: 70 } } }), 'lip')
    expect(result.status).toBe('done')
    if (result.status === 'done') expect(result.result.steps.map((step: any) => step.type)).toEqual(['makeup', 'earring'])
    expect(createTask.mock.calls.map(call => call[0])).toEqual(['makeup-vto', '2d-vto/earring'])
  })

  it('fully caches an identical lipstick request and reuses plain earring when lipstick is off', async () => {
    const plain = await finish(baseRequest(), 'reuse')
    const lipRequest = baseRequest({ options: { lipstick: { hex: '#9B1B30', texture: 'matte', intensity: 70 } } })
    await finish(lipRequest, 'reuse')
    const before = createTask.mock.calls.length
    const cachedLip = await service.createPipelineTryOnJob(lipRequest, 'reuse-2')
    expect(cachedLip.status).toBe('done')
    expect(createTask).toHaveBeenCalledTimes(before)
    if (cachedLip.status === 'done') expect(cachedLip.result.unitsSpent).toBe(0)
    const afterLip = createTask.mock.calls.length
    const plainAgain = await service.createPipelineTryOnJob(baseRequest(), 'reuse-3')
    expect(plainAgain.status).toBe('done')
    expect(createTask).toHaveBeenCalledTimes(afterLip)
    if (plain.status === 'done' && plainAgain.status === 'done') expect(plainAgain.result.key).toBe(plain.result.key)
  })

  it('runs hand flows as one step on the right endpoint with probed parameters', async () => {
    const ring = await finish({ photoId: 'photo-1', productId: 'gold-band', flow: 'hand' }, 'h1')
    expect(ring.status).toBe('done')
    expect(createTask.mock.calls[0][0]).toBe('2d-vto/ring')
    expect(createTask.mock.calls[0][1].object_infos[0].parameter).toMatchObject({ ring_wearing_finger: 3, ring_wearing_location: 0.3 })
    expect(createTask.mock.calls[0][1].object_infos[0].parameter).not.toHaveProperty('ring_anchor_point')

    await finish({ photoId: 'photo-1', productId: 'thin-cuff', flow: 'hand' }, 'h2')
    expect(createTask.mock.calls[1][0]).toBe('2d-vto/bracelet')
    expect(createTask.mock.calls[1][1].object_infos[0].parameter).not.toHaveProperty('bracelet_anchor_point')

    await finish({ photoId: 'photo-1', productId: 'gold-dress-watch', flow: 'hand' }, 'h3')
    expect(createTask.mock.calls[2][0]).toBe('2d-vto/watch')
    const pts = createTask.mock.calls[2][1].object_infos[0].parameter.watch_anchor_point
    // doc order: strap begin, strap end, case top, case bottom; case band unchanged at 1150 px
    expect(pts).toHaveLength(4)
    expect(pts[0][1]).toBeLessThan(pts[2][1]); expect(pts[2][1]).toBeLessThan(pts[3][1]); expect(pts[3][1]).toBeLessThan(pts[1][1])
    expect(pts[3][1] - pts[2][1]).toBe(1150)
    expect(assertCanSpend).toHaveBeenCalledWith('h3', 1)
  })

  it('keeps hand products out of face flows and face options out of the hand flow', async () => {
    await expect(service.createPipelineTryOnJob({ photoId: 'photo-1', productId: 'gold-band' } as any, 'x')).rejects.toMatchObject({ code: ErrorCodes.INVALID_INPUT })
    await expect(service.createPipelineTryOnJob({ photoId: 'photo-1', productId: 'gilded-teardrop', flow: 'hand' } as any, 'x')).rejects.toMatchObject({ code: ErrorCodes.INVALID_INPUT })
    await expect(service.createPipelineTryOnJob({ photoId: 'photo-1', productId: 'gold-band', flow: 'hand', options: { lipstick: { hex: '#123456', texture: 'matte', intensity: 50 } } } as any, 'x')).rejects.toMatchObject({ code: ErrorCodes.INVALID_INPUT })
    // ring size only makes sense for rings
    await expect(service.createPipelineTryOnJob({ photoId: 'photo-1', productId: 'thin-cuff', flow: 'hand', ringSizeUs: 7 } as any, 'x')).rejects.toMatchObject({ code: ErrorCodes.INVALID_INPUT })
    await expect(service.createPipelineTryOnJob({ photoId: 'photo-1', productId: 'gilded-teardrop', ringSizeUs: 7 } as any, 'x')).rejects.toMatchObject({ code: ErrorCodes.INVALID_INPUT })
  })

  it('plans necklace flows and rejects earring fields', async () => {
    const necklace = await finish(baseRequest({ flow: 'neck', productId: 'orb-chain', sizeCm: undefined }), 'neck')
    expect(necklace.status).toBe('done')
    if (necklace.status === 'done') expect(necklace.result.steps.map((step: any) => step.type)).toEqual(['necklace'])
    await expect(service.createPipelineTryOnJob(baseRequest({ flow: 'neck', productId: 'orb-chain', ear: 'right' }), 'bad')).rejects.toMatchObject({ code: ErrorCodes.INVALID_INPUT })
    const lip = await finish(baseRequest({ flow: 'neck', productId: 'orb-chain', sizeCm: undefined, options: { lipstick: { hex: '#123456', texture: 'matte', intensity: 50 } } }), 'neck-lip')
    if (lip.status === 'done') expect(lip.result.steps.map((step: any) => step.type)).toEqual(['makeup', 'necklace'])
  })

  it('maps necklace error 4 to NECK_NOT_VISIBLE', async () => {
    getTask.mockResolvedValueOnce({ status: 'error', errorMessage: '4', raw: { error: { error_code: 4 } } })
    const result = await finish(baseRequest({ flow: 'neck', productId: 'orb-chain', sizeCm: undefined }), 'neck-error')
    expect(result).toMatchObject({ status: 'error', code: ErrorCodes.NECK_NOT_VISIBLE, userMessage: 'Face the camera straight on with your neck and collarbones visible.' })
  })

  it('converts hair input to JPG with long side at most 1024 and adds identity note', async () => {
    const large = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 240, g: 240, b: 240 } } }).png().toBuffer() as unknown as Buffer
    await addPhoto('hair-photo', large as unknown as typeof PNG)
    const result = await finish(baseRequest({ photoId: 'hair-photo', options: { hairUp: { templateId: 'hair-1' } } }), 'hair')
    expect(result.status).toBe('done')
    const metadata = await sharp(uploadInputs[0]).metadata()
    expect(metadata.format).toBe('jpeg')
    expect(Math.max(metadata.width || 0, metadata.height || 0)).toBeLessThanOrEqual(1024)
    if (result.status === 'done') expect(result.result.identityNote).toBe('Hairstyle preview is AI-generated and may slightly change your appearance.')
  })

  it('pre-checks the sum of all uncached step units', async () => {
    await service.createPipelineTryOnJob(baseRequest({ options: { outfit: { productId: 'emerald-blouse' }, hairUp: { templateId: 'hair-1' }, lipstick: { hex: '#123456', texture: 'matte', intensity: 50 } } }), 'guard')
    expect(assertCanSpend).toHaveBeenCalledWith('guard', 6)
  })

  it('uses only one task call per status request across a three-step job', async () => {
    const created = await service.createPipelineTryOnJob(baseRequest({ options: { lipstick: { hex: '#123456', texture: 'matte', intensity: 50 }, hairUp: { templateId: 'hair-1' } } }), 'one-call')
    if (created.status !== 'running') throw new Error('expected running')
    const callCounts: number[] = []
    for (let i = 0; i < 8; i++) {
      await service.checkPipelineJobStatus(created.jobId)
      callCounts.push(createTask.mock.calls.length + getTask.mock.calls.length)
      const state = await storage.getJson<any>(storage.pipelineJobPath(created.jobId))
      if (state?.index >= 3) break
    }
    expect(callCounts.every((count, index) => index === 0 || count - callCounts[index - 1] <= 1)).toBe(true)
    expect(createTask.mock.calls.length).toBe(3)
    expect(getTask.mock.calls.length).toBe(3)
  })
})
