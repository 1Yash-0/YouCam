import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { YouCamClient } from '@/lib/youcam'
import { ErrorCodes } from '@/lib/errors'
import { createPipelineTryonService } from '@/lib/tryon-pipeline'
import { createStorage } from '@/lib/storage'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const credit = (amount: number) => json({ results: [{ type: 'ApiPaygToken', amount }] })
const task = (id: string) => json({ data: { task_id: id } })
const upload = (id: string) => json({ data: { files: [{ file_id: id, requests: [{ url: 'https://uploads.example/image', headers: {} }] }] } })

describe('YouCam exhausted-credit fallback', () => {
  let root: string
  let client: YouCamClient
  let calls: Array<{ url: string; key?: string; body?: any }>
  let responses: Response[]
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(process.cwd(), '.youcam-fallback-test-'))
    client = new YouCamClient({ apiKey: 'primary-test', fallbackKey: 'fallback-test', dataDir: root })
    calls = []; responses = []
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      calls.push({ url: String(url), key: (init?.headers as Record<string, string>)?.Authorization, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined })
      const response = responses.shift()
      if (!response) throw new Error('Unexpected request')
      return response
    })
  })
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }) })

  it('keeps one-key behavior when no fallback is configured', async () => {
    client = new YouCamClient({ apiKey: 'primary-test', dataDir: root })
    responses.push(credit(0), task('primary-only-task'))
    expect(await client.getBalance()).toBe(0)
    expect(await client.createTask('skin-tone-analysis', {})).toBe('primary-only-task')
    expect(calls.filter(c => c.url.includes('/client/credit'))).toHaveLength(1)
    expect(calls.map(c => c.key)).toEqual(['Bearer primary-test', 'Bearer primary-test'])
  })

  it.each([0, 449, 450])('blocks fallback task submission at fallback balance %i with BUDGET_RESERVED', async (fallbackBalance) => {
    responses.push(credit(0), credit(fallbackBalance))
    await expect(client.createTask('skin-tone-analysis', {})).rejects.toMatchObject({ code: ErrorCodes.BUDGET_RESERVED })
    expect(calls.map(c => c.key)).toEqual(['Bearer primary-test', 'Bearer fallback-test'])
    expect(calls.some(c => c.url.includes('/task/'))).toBe(false)
  })

  it.each([400, 500, 401])('does not switch or retry task failures with HTTP %i', async (status) => {
    responses.push(credit(800), json({ error: { message: 'Task failed' } }, status))
    await expect(client.createTask('skin-tone-analysis', {})).rejects.toThrow()
    expect(calls.map(c => c.key)).toEqual(['Bearer primary-test', 'Bearer primary-test'])
    expect(calls.filter(c => c.url.includes('/task/'))).toHaveLength(1)
  })
  it('uses primary even below reserve, and secondary only at zero', async () => {
    responses.push(credit(449), credit(0), credit(900))
    expect(await client.getBalance()).toBe(449)
    expect(await client.getBalance()).toBe(900)
    expect(calls.map(c => c.key)).toEqual(['Bearer primary-test', 'Bearer primary-test', 'Bearer fallback-test'])
  })

  it('blocks a fresh low primary balance even if an earlier guard check saw enough credits', async () => {
    responses.push(credit(900), credit(450))
    expect(await client.getBalance()).toBe(900)
    await expect(client.createTask('skin-tone-analysis', {})).rejects.toMatchObject({ code: ErrorCodes.BUDGET_RESERVED })
    expect(calls.some(c => c.url.includes('/task/'))).toBe(false)
    expect(calls.every(c => c.key === 'Bearer primary-test')).toBe(true)
  })

  it('keeps a task selection separate from a concurrent balance request selecting fallback', async () => {
    responses.push(credit(800), credit(0), credit(900), task('concurrent-primary'))
    const [taskId, balance] = await Promise.all([client.createTask('skin-tone-analysis', {}), client.getBalance()])
    expect(taskId).toBe('concurrent-primary')
    expect(balance).toBe(900)
    expect(calls.find(c => c.url.includes('/task/'))?.key).toBe('Bearer primary-test')
  })

  it('does not switch for auth, validation, server or network failures', async () => {
    for (const status of [401, 400, 500]) {
      responses.push(json({ error: { message: 'Failed' } }, status))
      await expect(client.getBalance()).rejects.toThrow()
    }
    await expect(client.getBalance()).rejects.toThrow()
    expect(calls.every(c => c.key === 'Bearer primary-test')).toBe(true)
  })

  it('does not switch a positive balance after CreditInsufficiency', async () => {
    responses.push(credit(800), json({ error: { error_code: 'CreditInsufficiency', message: 'Insufficient unit to run' } }, 400), credit(1))
    await expect(client.createTask('skin-tone-analysis', {})).rejects.toThrow()
    expect(calls.every(c => c.key === 'Bearer primary-test')).toBe(true)
  })

  it('reuploads legacy files on fallback, persists task ownership across restart and keeps keys off disk', async () => {
    await client.rememberFile('legacy-file', async () => ({ bytes: Buffer.from('image'), contentType: 'image/png', fileName: 'private-photo.png' }))
    responses.push(credit(0), credit(900), upload('fallback-file'), new Response(null, { status: 200 }), task('fallback-task'))
    expect(await client.createTask('skin-tone-analysis', { src_file_id: 'legacy-file' })).toBe('fallback-task')
    expect(calls.at(-1)?.body.src_file_id).toBe('fallback-file')
    expect(calls.at(-1)?.key).toBe('Bearer fallback-test')
    expect(calls.find(c => c.url.startsWith('https://uploads.'))?.key).toBeUndefined()

    client = new YouCamClient({ apiKey: 'primary-test', fallbackKey: 'fallback-test', dataDir: root })
    responses.push(json({ data: { task_status: 'success', results: { url: 'https://result.example/image' } } }))
    expect((await client.getTask('skin-tone-analysis', 'fallback-task')).status).toBe('success')
    expect(calls.at(-1)?.key).toBe('Bearer fallback-test')
    const resourceDir = path.join(root, 'youcam-resources')
    const disk = (await Promise.all((await fs.readdir(resourceDir)).map(name => fs.readFile(path.join(resourceDir, name), 'utf8')))).join('')
    expect(disk).not.toContain('primary-test')
    expect(disk).not.toContain('fallback-test')
    const storage = createStorage({ rootDir: root })
    const records = await Promise.all((await storage.list?.('youcam-resources/') ?? []).filter(key => key.endsWith('.json')).map(async key => ({ key, value: await storage.getJson<Record<string, unknown>>(key) })))
    const sourceRecord = records.find(entry => entry.value?.fileId === 'legacy-file')?.value
    const fallbackRecord = records.find(entry => entry.value?.fileId === 'fallback-file')?.value
    const aliasRecord = records.find(entry => entry.value?.sourceFileId === 'legacy-file')?.value
    expect(sourceRecord?.expiresAt).toBeTruthy()
    expect(fallbackRecord?.expiresAt).toBe(sourceRecord?.expiresAt)
    expect(aliasRecord?.expiresAt).toBe(sourceRecord?.expiresAt)
    await client.forgetFile('legacy-file')
    const remaining = await storage.list?.('youcam-resources/') ?? []
    expect(remaining.some(key => key.endsWith('.bin'))).toBe(false)
    expect(remaining.some(key => key.includes('/file-') || key.includes('/alias-'))).toBe(false)
  })

  it('expires private recovery bytes after 24 hours while retaining product recovery files', async () => {
    const storage = createStorage({ rootDir: root })
    const privateBytes = Buffer.from('private-photo-bytes')
    await client.rememberFile('private-photo-id', async () => ({ bytes: privateBytes, contentType: 'image/png', fileName: 'private-photo.png' }))
    await client.rememberFile('public-product-id', async () => ({ bytes: Buffer.from('catalogue-image'), contentType: 'image/png', fileName: 'product-image.png' }))
    await storage.putJson('youcam-resources/blob-index-orphan.json', { blob: 'orphan-blob', createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() })
    await storage.putFile('youcam-resources/orphan-blob.bin', Buffer.from('orphan'))
    const cutoff = new Date(Date.now() + 25 * 60 * 60 * 1000)

    const result = await client.cleanupExpiredFiles(cutoff)
    expect(result.filesRemoved).toBe(1)
    expect(result.bytesRemoved).toBeGreaterThanOrEqual(6)
    const remaining = await storage.list?.('youcam-resources/') ?? []
    expect(remaining.some(key => key.endsWith('.bin'))).toBe(true)
    expect(remaining).not.toContain('youcam-resources/orphan-blob.bin')
    const records = await Promise.all(remaining.filter(key => key.includes('/file-')).map(async key => storage.getJson<Record<string, unknown>>(key)))
    expect(records.some(record => record?.fileId === 'public-product-id')).toBe(true)
    expect(records.some(record => record?.fileId === 'private-photo-id')).toBe(false)
  })

  it('retries once after a confirmed zero-credit race and remaps reference arrays', async () => {
    await client.rememberFile('ref-primary', async () => ({ bytes: Buffer.from('product'), contentType: 'image/png', fileName: 'product.png' }))
    responses.push(credit(800), json({ error: { error_code: 'CreditInsufficiency', message: 'Insufficient unit to run' } }, 400), credit(0), credit(800), upload('ref-fallback'), new Response(null, { status: 200 }), task('retried'))
    expect(await client.createTask('2d-vto/necklace', { src_file_url: 'https://photo.example/image', ref_file_ids: ['ref-primary'], object_infos: [] })).toBe('retried')
    expect(calls.at(-1)?.body.ref_file_ids).toEqual(['ref-fallback'])
    expect(calls.filter(c => c.url.includes('/task/'))).toHaveLength(2)
  })

  it('keeps a successfully created primary task on primary after fallback selection and restart', async () => {
    responses.push(credit(800), task('primary-created-task'), credit(0), credit(900))
    expect(await client.createTask('skin-tone-analysis', {})).toBe('primary-created-task')
    expect(await client.getBalance()).toBe(900)

    client = new YouCamClient({ apiKey: 'primary-test', fallbackKey: 'fallback-test', dataDir: root })
    responses.push(json({ data: { task_status: 'running' } }))
    expect((await client.getTask('skin-tone-analysis', 'primary-created-task')).status).toBe('running')
    expect(calls.at(-1)?.key).toBe('Bearer primary-test')
  })

  it('fails without submitting when a cross-account file cannot be recovered', async () => {
    responses.push(credit(0), credit(800))
    await expect(client.createTask('skin-tone-analysis', { src_file_id: 'missing-old-file' })).rejects.toThrow(/upload/i)
    expect(calls.some(c => c.url.includes('/task/'))).toBe(false)
  })

  it('recovers a legacy pipeline photo from local storage before submitting on fallback', async () => {
    const storage = createStorage({ rootDir: root })
    await storage.putFile(storage.photoPath('photo'), Buffer.from('local-photo'))
    await storage.putJson(storage.photoMetaPath('photo'), { fileId: 'legacy-photo', uploadedAt: new Date().toISOString(), width: 10, height: 10 })
    await client.rememberFile('legacy-product', async () => ({ bytes: Buffer.from('product'), contentType: 'image/png', fileName: 'product.png' }))
    const pipeline = createPipelineTryonService({
      storage,
      youcam: {
        rememberFile: client.rememberFile.bind(client), uploadFile: client.uploadFile.bind(client),
        createTask: (feature, body) => client.createTask(feature, body), getTask: client.getTask.bind(client),
      },
      products: { getProductWithFileId: async () => ({ product: { id: 'necklace', type: 'necklace' }, fileId: 'legacy-product' }) },
      guard: { assertCanSpend: async () => {}, recordSpend: async () => {} },
      fetchBytes: async () => Buffer.from('result'), measure: async () => ({}), now: () => new Date(), uuid: () => 'legacy-job',
    })
    const job = await pipeline.createPipelineTryOnJob({ photoId: 'photo', productId: 'necklace', flow: 'neck' }, 'visitor')
    expect(job.status).toBe('running')
    if (job.status !== 'running') throw new Error('Expected an uncached job')
    responses.push(credit(0), credit(900), upload('new-photo'), new Response(null, { status: 200 }), upload('new-product'), new Response(null, { status: 200 }), task('pipeline-task'))
    expect((await pipeline.checkPipelineJobStatus(job.jobId)).status).toBe('running')
    expect(calls.at(-1)?.body.src_file_id).toBe('new-photo')
    expect(calls.at(-1)?.body.ref_file_ids).toEqual(['new-product'])
    expect(calls.at(-1)?.key).toBe('Bearer fallback-test')
  })
})
