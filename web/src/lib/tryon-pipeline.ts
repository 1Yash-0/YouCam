import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { sha256 } from './hash'
import { createTask, getTask, uploadFile } from './youcam'
import { assertCanSpend, recordSpend } from './guard'
import { getProductWithFileId } from './products'
import { createStorage, StorageInstance } from './storage'
import { AppError, ErrorCodes, mapYouCamError } from './errors'
import { measure } from './size'

export type TryOnFlow = 'ear' | 'neck'
export type StepType = 'earring' | 'stack' | 'necklace' | 'makeup' | 'hair' | 'cloth'
export const UNITS_TABLE: Record<StepType, number> = { earring: 1, stack: 2, necklace: 1, makeup: 1, hair: 2, cloth: 2 }

export interface StackItem { productId: string; sizeCm: number; wearingLocation: [number, number] }
export interface TryOnPipelineRequest {
  flow?: TryOnFlow; photoId: string; productId: string; sizeCm?: number; ear?: 'right' | 'left'; occluded?: 0 | 1 | 2
  wearingLocation?: [number, number]; irisPx?: number; stack?: StackItem[]
  options?: { hairUp?: { templateId: string }; lipstick?: { hex: string; texture: string; intensity: number }; outfit?: { productId: string } }
}
export interface StepRecord {
  type: StepType; params: any; status: 'pending' | 'running' | 'done' | 'error'; taskId?: string
  inputHash: string; outputHash?: string; cacheKey?: string; outputFileId?: string; units: number; cached: boolean
  errorCode?: string; errorMessage?: string
}
export interface PipelineJobRecord {
  jobId: string; flow: TryOnFlow; steps: StepRecord[]; index: number; visitorId: string; createdAt: string
  currentStepInputFileId: string; originalPhotoId: string; irisPx?: number; earPinned: boolean; earRetryAttempts: number
  products: Record<string, { fileId: string; type: string; garmentCategory?: string }>
}
export interface PipelineResult {
  key: string; imageUrl: string; flow: TryOnFlow
  steps: Array<{ type: StepType; units: number; cached: boolean }>; unitsSpent: number
  measurement?: any; identityNote?: string
}
export interface PhotoMeta { fileId: string; uploadedAt: string; width: number; height: number }
export interface StepCacheMeta { key: string; stepType: StepType; paramsHash: string; inputHash: string; outputHash: string; outputFileId: string; createdAt: string; units: number }

export interface PipelineDeps {
  youcam: {
    uploadFile: (bytes: Buffer, contentType: 'image/png' | 'image/jpeg', fileName: string) => Promise<string>
    createTask: (feature: import('./youcam').YouCamFeature, body: any) => Promise<string>
    getTask: (feature: import('./youcam').YouCamFeature, taskId: string) => Promise<{ status: 'running' | 'success' | 'error'; resultUrl?: string; errorMessage?: string; raw: unknown }>
  }
  fetchBytes: (url: string) => Promise<Buffer>
  storage: StorageInstance
  guard: { assertCanSpend: (visitorId: string, units: number) => Promise<void>; recordSpend: (visitorId: string, units: number) => Promise<void> }
  products: { getProductWithFileId: (productId: string) => Promise<{ product: any; fileId: string } | null> }
  measure: (params: { before: Buffer; after: Buffer; requestedCm: number; irisPx?: number }) => Promise<any>
  now: () => Date
  uuid: () => string
}

function canonical(value: any): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
}
export function hashParams(params: any): string { return sha256(canonical(params)) }
export function stepCacheKey(params: { inputHash: string; stepType: StepType; paramsHash: string }): string {
  return sha256(`${params.inputHash}${params.stepType}${params.paramsHash}v1`)
}

function planSteps(request: TryOnPipelineRequest): StepType[] {
  const steps: StepType[] = []
  if (request.options?.outfit) steps.push('cloth')
  if (request.options?.hairUp) steps.push('hair')
  if (request.options?.lipstick) steps.push('makeup')
  steps.push(request.flow === 'neck' ? 'necklace' : request.stack?.length ? 'stack' : 'earring')
  return steps
}
function featureFor(type: StepType): import('./youcam').YouCamFeature {
  if (type === 'earring' || type === 'stack') return '2d-vto/earring'
  if (type === 'necklace') return '2d-vto/necklace'
  if (type === 'makeup') return 'makeup-vto'
  if (type === 'hair') return 'hair-transfer'
  return 'cloth-v4'
}
function mapOptionalError(type: StepType, fallback: string): string {
  if (type === 'hair') return ErrorCodes.HAIR_FAILED
  if (type === 'makeup') return ErrorCodes.MAKEUP_FAILED
  if (type === 'cloth') return ErrorCodes.OUTFIT_FAILED
  return fallback
}
function validateStackGap(items: StackItem[], irisPx?: number): void {
  if (items.length < 2) return
  const min = irisPx ? 0.8 * irisPx / 1.17 : 30
  const sorted = [...items].sort((a, b) => a.wearingLocation[1] - b.wearingLocation[1])
  for (let i = 1; i < sorted.length; i++) if (Math.abs(sorted[i].wearingLocation[1] - sorted[i - 1].wearingLocation[1]) < min) throw new AppError(ErrorCodes.STACK_TOO_CLOSE, `Stack items too close vertically: minimum ${min.toFixed(1)} pixels required`, 400)
}

export function createPipelineTryonService(deps: PipelineDeps) {
  const { youcam, fetchBytes, storage, guard, products, measure, now, uuid } = deps
  const actionLocks = new Map<string, Promise<any>>()
  const lock = <T>(key: string, action: () => Promise<T>): Promise<T> => {
    const existing = actionLocks.get(key)
    if (existing) return existing as Promise<T>
    const promise = action().finally(() => actionLocks.delete(key))
    actionLocks.set(key, promise)
    return promise
  }

  async function photoBytes(job: PipelineJobRecord): Promise<Buffer> {
    return (await storage.getFile(storage.photoPath(job.originalPhotoId))) || Buffer.from(job.currentStepInputFileId)
  }
  async function inputBytes(job: PipelineJobRecord, index: number): Promise<Buffer> {
    if (index === 0) return photoBytes(job)
    const previous = job.steps[index - 1]
    if (!previous.cacheKey) throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Previous step output is unavailable', 500)
    const bytes = await storage.getFile(storage.stepCacheFilePath(previous.cacheKey))
    if (!bytes) throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Previous step image is unavailable', 500)
    return bytes
  }
  function product(job: PipelineJobRecord, id: string) {
    const value = job.products[id]
    if (!value) throw new AppError(ErrorCodes.NOT_FOUND, `Product not found: ${id}`, 404)
    return value
  }

  function semanticParams(type: StepType, request: TryOnPipelineRequest, productMap: Map<string, { product: any; fileId: string }>): any {
    if (type === 'earring') {
      const p = productMap.get(request.productId)!
      return { productId: request.productId, sizeCm: request.sizeCm ?? p.product.heightCm, rightEar: request.ear !== 'left', occluded: request.occluded ?? 0, wearingLocation: request.wearingLocation ?? null, irisPx: request.irisPx ?? null }
    }
    if (type === 'stack') return { items: request.stack, rightEar: request.ear !== 'left', occluded: request.occluded ?? 0, irisPx: request.irisPx ?? null }
    if (type === 'necklace') return { productId: request.productId }
    if (type === 'makeup') return { lipstick: request.options!.lipstick }
    if (type === 'hair') return { hairUp: request.options!.hairUp, keepUserColour: true }
    const outfit = request.options!.outfit!
    return { productId: outfit.productId, garmentCategory: productMap.get(outfit.productId)!.product.garmentCategory }
  }

  function taskBody(job: PipelineJobRecord, step: StepRecord, srcFileId: string): any {
    const p = step.params
    if (step.type === 'earring') {
      const ref = product(job, p.productId)
      return { src_file_id: srcFileId, ref_file_ids: [ref.fileId], source_info: { name: 'face' }, object_infos: [{ name: 'gen_earring.png', parameter: {
        earring_need_remove_background: true, ...(p.wearingLocation ? { earring_wearing_location: p.wearingLocation } : {}), earring_scale: p.sizeCm, earring_is_right_ear: p.rightEar, earring_occluded_type: p.occluded, earring_shadow_intensity: 0.5, earring_ambient_light_intensity: 0.5,
      } }] }
    }
    if (step.type === 'stack') return { src_file_id: srcFileId, ref_file_ids: p.items.map((item: StackItem) => product(job, item.productId).fileId), source_info: { name: 'gen_face.png' }, object_infos: p.items.map((item: StackItem) => ({ name: 'gen_earring.png', parameter: {
      earring_need_remove_background: true, earring_wearing_location: item.wearingLocation, earring_scale: item.sizeCm, earring_is_right_ear: p.rightEar, earring_occluded_type: p.occluded, earring_shadow_intensity: 0.5, earring_ambient_light_intensity: 0.5,
    } })) }
    if (step.type === 'necklace') { const ref = product(job, p.productId); return { src_file_id: srcFileId, ref_file_ids: [ref.fileId], source_info: { name: 'gen_face.png' }, object_infos: [{ name: 'gen_necklace.png', parameter: { necklace_need_remove_background: true, necklace_shadow_intensity: 0.5, necklace_ambient_light_intensity: 0.5 } }] } }
    if (step.type === 'makeup') return { src_file_id: srcFileId, version: '1.0', effects: [
      { category: 'skin_smooth', skinSmoothStrength: 0, skinSmoothColorIntensity: 0 },
      { category: 'lip_color', shape: { name: 'original' }, morphology: { fullness: 50, wrinkless: 50 }, palettes: [{ color: p.lipstick.hex, texture: p.lipstick.texture, colorIntensity: p.lipstick.intensity }], style: { type: 'full' } },
    ] }
    if (step.type === 'hair') return { src_file_id: srcFileId, template_id: p.hairUp.templateId, parameters: { keep_hair_color: p.keepUserColour } }
    const ref = product(job, p.productId)
    return { src_file_id: srcFileId, ref_file_id: ref.fileId, garment_category: p.garmentCategory }
  }

  async function markSpend(job: PipelineJobRecord, index: number, units: number): Promise<void> {
    if (!units) return
    const marker = storage.finalisedMarkerPath(`${job.jobId}-${index}`)
    await fs.mkdir(path.dirname(path.join(storage.rootDir, marker)), { recursive: true })
    try {
      const handle = await fs.open(path.join(storage.rootDir, marker), 'wx')
      await handle.close()
      await guard.recordSpend(job.visitorId, units)
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error
    }
  }

  async function buildResult(job: PipelineJobRecord): Promise<{ status: 'done'; result: PipelineResult }> {
    const keys = job.steps.map(step => step.cacheKey!)
    const key = sha256(JSON.stringify(keys))
    const final = job.steps[job.steps.length - 1]
    const finalBytes = await storage.getFile(storage.stepCacheFilePath(final.cacheKey!))
    if (!finalBytes) throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Final result is unavailable', 500)
    if (!(await storage.exists(storage.resultPath(key)))) await storage.putFile(storage.resultPath(key), finalBytes)
    const result: PipelineResult = {
      key, imageUrl: `/api/result/${key}`, flow: job.flow,
      steps: job.steps.map(step => ({ type: step.type, units: step.units, cached: step.cached })),
      unitsSpent: job.steps.reduce((sum, step) => sum + (step.cached ? 0 : step.units), 0),
    }
    if (job.flow === 'ear') {
      const earringIndex = job.steps.findIndex(step => step.type === 'earring' || step.type === 'stack')
      const earring = job.steps[earringIndex]
      try {
        const before = await inputBytes(job, earringIndex)
        const after = await storage.getFile(storage.stepCacheFilePath(earring.cacheKey!))
        if (after) result.measurement = await measure({ before, after, requestedCm: earring.params.type === 'stack' ? earring.params.items[0].sizeCm : earring.params.sizeCm, irisPx: job.irisPx })
      } catch { /* measurement is best effort */ }
    }
    if (job.steps.some(step => step.type === 'hair')) result.identityNote = 'Hairstyle preview is AI-generated and may slightly change your appearance.'
    return { status: 'done', result }
  }

  async function cachedAdvance(job: PipelineJobRecord): Promise<any> {
    while (job.index < job.steps.length && job.steps[job.index].cached) {
      const step = job.steps[job.index]
      step.status = 'done'; job.currentStepInputFileId = step.outputFileId!
      job.index++
    }
    await storage.putJson(storage.pipelineJobPath(job.jobId), job)
    if (job.index >= job.steps.length) return buildResult(job)
    return { status: 'running', step: job.steps[job.index].type, stepIndex: job.index, totalSteps: job.steps.length }
  }

  async function createJob(request: TryOnPipelineRequest, visitorId: string): Promise<{ status: 'running'; jobId: string } | { status: 'done'; result: PipelineResult }> {
    const flow = request.flow || 'ear'
    if (flow === 'neck' && (request.sizeCm !== undefined || request.ear !== undefined || request.stack !== undefined || request.wearingLocation !== undefined)) throw new AppError(ErrorCodes.INVALID_INPUT, 'Necklace flow cannot include earring fields', 400)
    if (request.stack) validateStackGap(request.stack, request.irisPx)
    const ids = new Set<string>([request.productId, ...(request.stack || []).map(item => item.productId), ...(request.options?.outfit ? [request.options.outfit.productId] : [])])
    const productMap = new Map<string, { product: any; fileId: string }>()
    for (const id of ids) { const found = await products.getProductWithFileId(id); if (!found) throw new AppError(ErrorCodes.NOT_FOUND, `Product not found: ${id}`, 404); productMap.set(id, found) }
    const selected = productMap.get(request.productId)!.product
    if (flow === 'neck' && selected.type !== 'necklace') throw new AppError(ErrorCodes.INVALID_INPUT, 'Necklace flow requires necklace product type', 400)
    if (flow === 'ear' && selected.type === 'necklace') throw new AppError(ErrorCodes.INVALID_INPUT, 'Ear flow requires an earring product', 400)
    const meta = await storage.getJson<PhotoMeta>(storage.photoMetaPath(request.photoId))
    if (!meta) throw new AppError(ErrorCodes.NOT_FOUND, `Photo not found: ${request.photoId}`, 404)
    const original = await photoBytes({ currentStepInputFileId: meta.fileId, originalPhotoId: request.photoId } as PipelineJobRecord)
    const steps: StepRecord[] = []
    let inputHash = sha256(original)
    let inputFileId = meta.fileId
    let canResolveCache = true
    const types = planSteps(request)
    for (const type of types) {
      const params = semanticParams(type, request, productMap)
      const paramsHash = hashParams(params)
      const key = stepCacheKey({ inputHash, stepType: type, paramsHash })
      const cachedMeta = canResolveCache ? await storage.getJson<StepCacheMeta>(storage.stepCacheMetaPath(key)) : null
      const cached = Boolean(cachedMeta && await storage.exists(storage.stepCacheFilePath(key)))
      steps.push({ type, params, status: 'pending', inputHash, cacheKey: cached ? key : undefined, outputFileId: cached ? cachedMeta!.outputFileId : undefined, outputHash: cached ? cachedMeta!.outputHash : undefined, units: UNITS_TABLE[type], cached })
      if (cached) { inputHash = cachedMeta!.outputHash; inputFileId = cachedMeta!.outputFileId } else canResolveCache = false
    }
    const needed = steps.reduce((sum, step) => sum + (step.cached ? 0 : step.units), 0)
    await guard.assertCanSpend(visitorId, needed)
    const job: PipelineJobRecord = { jobId: uuid(), flow, steps, index: 0, visitorId, createdAt: now().toISOString(), currentStepInputFileId: inputFileId, originalPhotoId: request.photoId, irisPx: request.irisPx, earPinned: request.ear !== undefined, earRetryAttempts: 0, products: Object.fromEntries([...productMap].map(([id, p]) => [id, { fileId: p.fileId, type: p.product.type, garmentCategory: p.product.garmentCategory }])) }
    await storage.putJson(storage.pipelineJobPath(job.jobId), job)
    if (steps.every(step => step.cached)) return (await cachedAdvance(job)) as { status: 'done'; result: PipelineResult }
    return { status: 'running', jobId: job.jobId }
  }

  async function startStep(job: PipelineJobRecord, index: number): Promise<any> {
    const step = job.steps[index]
    if (step.cached) return cachedAdvance(job)
    const bytes = await inputBytes(job, index)
    step.inputHash = sha256(bytes)
    const key = stepCacheKey({ inputHash: step.inputHash, stepType: step.type, paramsHash: hashParams(step.params) })
    step.cacheKey = key
    const existing = await storage.getJson<StepCacheMeta>(storage.stepCacheMetaPath(key))
    if (existing && await storage.exists(storage.stepCacheFilePath(key))) { step.cached = true; step.outputFileId = existing.outputFileId; step.outputHash = existing.outputHash; return cachedAdvance(job) }
    let sourceFileId = job.currentStepInputFileId
    if (step.type === 'hair') {
      const image = sharp(bytes)
      const metadata = await image.metadata()
      const longSide = Math.max(metadata.width || 0, metadata.height || 0)
      const resized = longSide > 1024 ? image.resize({ width: (metadata.width || 1) >= (metadata.height || 1) ? 1024 : undefined, height: (metadata.height || 1) > (metadata.width || 1) ? 1024 : undefined, fit: 'inside', withoutEnlargement: true }) : image
      const jpg = await resized.jpeg().toBuffer()
      sourceFileId = await youcam.uploadFile(jpg, 'image/jpeg', `hair-input-${job.jobId}.jpg`)
    }
    let taskId: string
    try {
      taskId = await youcam.createTask(featureFor(step.type), taskBody(job, step, sourceFileId))
    } catch (error) {
      const appError = error instanceof AppError ? error : null
      const message = appError?.message || 'Task creation failed'
      const rawCode = appError?.code
      if (step.type === 'earring' && !job.earPinned && job.earRetryAttempts === 0 && (rawCode === ErrorCodes.EAR_NOT_VISIBLE || mapYouCamError(message).code === ErrorCodes.EAR_NOT_VISIBLE)) {
        step.params.rightEar = !step.params.rightEar; step.status = 'pending'; step.cacheKey = undefined; job.earRetryAttempts = 1
        await storage.putJson(storage.pipelineJobPath(job.jobId), job)
        return { status: 'running', step: step.type, stepIndex: index, totalSteps: job.steps.length }
      }
      let code = mapYouCamError(message).code
      let userMessage = mapYouCamError(message).userMessage
      if (step.type === 'necklace' && (rawCode === '4' || rawCode === ErrorCodes.PHOTO_CHECK_INVALID || message.includes('PHOTO_CHECK_INVALID'))) { code = ErrorCodes.NECK_NOT_VISIBLE; userMessage = 'Face the camera straight on with your neck and collarbones visible.' }
      else if (step.type === 'hair' || step.type === 'makeup' || step.type === 'cloth') { code = mapOptionalError(step.type, code); userMessage = 'This preview step failed. Please try again.' }
      step.status = 'error'; step.errorCode = code; step.errorMessage = userMessage
      await storage.putJson(storage.pipelineJobPath(job.jobId), job)
      return { status: 'error', code, userMessage, step: step.type }
    }
    step.status = 'running'; step.taskId = taskId
    await storage.putJson(storage.pipelineJobPath(job.jobId), job)
    return { status: 'running', step: step.type, stepIndex: index, totalSteps: job.steps.length }
  }

  async function pollStep(job: PipelineJobRecord, index: number): Promise<any> {
    return lock(`${job.jobId}:${index}:poll`, async () => {
      const step = job.steps[index]
      const task = await youcam.getTask(featureFor(step.type), step.taskId!)
      if (task.status === 'running') return { status: 'running', step: step.type, stepIndex: index, totalSteps: job.steps.length }
      if (task.status === 'error') {
        const raw: any = task.raw
        const rawCode = raw?.error?.error_code ?? raw?.data?.error?.error_code
        const message = task.errorMessage || String(rawCode || '')
        if (step.type === 'earring' && !job.earPinned && job.earRetryAttempts === 0 && mapYouCamError(message).code === ErrorCodes.EAR_NOT_VISIBLE) {
          step.params.rightEar = !step.params.rightEar; step.status = 'pending'; step.taskId = undefined; step.cacheKey = undefined; job.earRetryAttempts = 1
          await storage.putJson(storage.pipelineJobPath(job.jobId), job)
          return { status: 'running', step: step.type, stepIndex: index, totalSteps: job.steps.length }
        }
        let code = mapYouCamError(message).code
        let userMessage = mapYouCamError(message).userMessage
        if (step.type === 'necklace' && (message.includes('PHOTO_CHECK_INVALID') || String(rawCode) === '4' || message.trim() === '4')) { code = ErrorCodes.NECK_NOT_VISIBLE; userMessage = 'Face the camera straight on with your neck and collarbones visible.' }
        else if (step.type === 'hair' || step.type === 'makeup' || step.type === 'cloth') { code = mapOptionalError(step.type, code); userMessage = 'This preview step failed. Please try again.' }
        step.status = 'error'; step.errorCode = code; step.errorMessage = userMessage
        await storage.putJson(storage.pipelineJobPath(job.jobId), job)
        return { status: 'error', code, userMessage, step: step.type }
      }
      if (!task.resultUrl) throw new AppError(ErrorCodes.TRYON_FAILED, 'Task succeeded but no result URL', 500)
      const output = await fetchBytes(task.resultUrl)
      const cacheKey = step.cacheKey!
      await storage.putFile(storage.stepCacheFilePath(cacheKey), output)
      const outputHash = sha256(output)
      const outputFileId = await youcam.uploadFile(output, 'image/png', `pipeline-${job.jobId}-${index}.png`)
      await storage.putJson(storage.stepCacheMetaPath(cacheKey), { key: cacheKey, stepType: step.type, paramsHash: hashParams(step.params), inputHash: step.inputHash, outputHash, outputFileId, createdAt: now().toISOString(), units: step.units } satisfies StepCacheMeta)
      await markSpend(job, index, step.units)
      step.status = 'done'; step.outputHash = outputHash; step.outputFileId = outputFileId; job.currentStepInputFileId = outputFileId; job.index = index + 1
      await storage.putJson(storage.pipelineJobPath(job.jobId), job)
      if (job.index >= job.steps.length) return buildResult(job)
      return { status: 'running', step: job.steps[job.index].type, stepIndex: job.index, totalSteps: job.steps.length }
    })
  }

  async function status(jobId: string): Promise<any> {
    const job = await storage.getJson<PipelineJobRecord>(storage.pipelineJobPath(jobId))
    if (!job) throw new AppError(ErrorCodes.NOT_FOUND, `Job not found: ${jobId}`, 404)
    if (job.index >= job.steps.length) return buildResult(job)
    const step = job.steps[job.index]
    if (step.status === 'error') return { status: 'error', code: step.errorCode || ErrorCodes.TRYON_FAILED, userMessage: step.errorMessage || 'Step failed', step: step.type }
    if (step.cached) return cachedAdvance(job)
    if (step.status === 'pending') return lock(`${job.jobId}:${job.index}:create`, () => startStep(job, job.index))
    if (step.status === 'running') return pollStep(job, job.index)
    throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Invalid pipeline step state', 500)
  }

  return { createPipelineTryOnJob: createJob, checkPipelineJobStatus: status, createTryOnJob: createJob, checkJobStatus: status }
}

import * as youcamModule from './youcam'
import * as guardModule from './guard'
import * as productsModule from './products'
import { defaultStorage } from './storage'
import * as sizeModule from './size'
const defaultDeps: PipelineDeps = {
  youcam: { uploadFile: youcamModule.uploadFile, createTask: (feature, body) => youcamModule.createTask(feature as any, body), getTask: youcamModule.getTask },
  fetchBytes: async url => { const response = await fetch(url); if (!response.ok) throw new Error(`Failed to fetch result: HTTP ${response.status}`); return Buffer.from(await response.arrayBuffer()) },
  storage: defaultStorage,
  guard: { assertCanSpend: guardModule.assertCanSpend, recordSpend: guardModule.recordSpend },
  products: { getProductWithFileId: productsModule.getProductWithFileId },
  measure: sizeModule.measure,
  now: () => new Date(),
  uuid: () => crypto.randomUUID(),
}
export const pipelineService = createPipelineTryonService(defaultDeps)
export const { createPipelineTryOnJob, checkPipelineJobStatus } = pipelineService
