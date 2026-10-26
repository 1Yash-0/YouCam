import { env } from './env'
import { AppError, ErrorCodes } from './errors'
import { createHash } from 'crypto'
import { createStorage, defaultStorage, type StorageInstance } from './storage'

export interface CreditEntry { type: string; amount: number; expiry: string }
export interface UploadResponse { file_id: string; requests: Array<{ method: string; url: string; headers: Record<string, string> }> }
export interface TaskResponse { task_id: string }
export interface TaskStatusResponse {
  task_status: 'running' | 'success' | 'error'
  results?: Array<{ url?: string; download_url?: string }> | { url?: string; download_url?: string }
  error?: { message: string; error_code?: number | string }
}
export interface HairTemplate { template_id: string; title: string; cover: string; style?: string }
export interface HairTemplatesResponse { templates: HairTemplate[]; starting_token?: string }

export type YouCamFeature =
  | '2d-vto/earring'
  | '2d-vto/necklace'
  | '2d-vto/ring'
  | '2d-vto/bracelet'
  | '2d-vto/watch'
  | 'makeup-vto'
  | 'hair-transfer'
  | 'cloth-v4'
  | 'skin-tone-analysis'
  | 'text-to-image'

export const YOUCAM_ENDPOINTS: Record<YouCamFeature, string> = {
  '2d-vto/earring': '/s2s/v2.0/task/2d-vto/earring',
  '2d-vto/necklace': '/s2s/v2.0/task/2d-vto/necklace',
  '2d-vto/ring': '/s2s/v2.0/task/2d-vto/ring',
  '2d-vto/bracelet': '/s2s/v2.0/task/2d-vto/bracelet',
  '2d-vto/watch': '/s2s/v2.0/task/2d-vto/watch',
  'makeup-vto': '/s2s/v2.0/task/makeup-vto',
  'hair-transfer': '/s2s/v2.1/task/hair-transfer',
  'cloth-v4': '/s2s/v2.0/task/cloth-v4',
  'skin-tone-analysis': '/s2s/v2.0/task/skin-tone-analysis',
  'text-to-image': '/s2s/v2.0/task/text-to-image/youcam',
}

export interface EarringSingleBody {
  src_file_id?: string; src_file_url?: string; ref_file_ids?: string[]; ref_file_urls?: string[]
  source_info?: { name: string }
  object_infos: Array<{ name: string; parameter: {
    earring_need_remove_background: boolean; earring_wearing_location?: [number, number]
    earring_scale: number; earring_is_right_ear: boolean; earring_occluded_type: 0 | 1 | 2
    earring_shadow_intensity: number; earring_ambient_light_intensity: number
    earring_anchor_point?: [[number, number]]
  }}> 
}
export interface EarringStackBody extends EarringSingleBody {
  object_infos: Array<{ name: string; parameter: {
    earring_need_remove_background: boolean; earring_wearing_location: [number, number]
    earring_scale: number; earring_is_right_ear: boolean; earring_occluded_type: 0 | 1 | 2
    earring_shadow_intensity: number; earring_ambient_light_intensity: number
    earring_anchor_point?: [[number, number]]
  }}> 
}
export interface NecklaceBody {
  src_file_id?: string; src_file_url?: string; ref_file_ids?: string[]; ref_file_urls?: string[]
  source_info?: { name: string }
  object_infos: Array<{ name: string; parameter: {
    necklace_need_remove_background: boolean; necklace_wearing_location?: [[number, number], [number, number]]
    necklace_anchor_point?: [[number, number], [number, number]]
    necklace_shadow_intensity: number; necklace_ambient_light_intensity: number
  }}> 
}
type Pt = [number, number]
interface HandVtoBase { src_file_id?: string; src_file_url?: string; ref_file_ids?: string[]; ref_file_urls?: string[]; source_info?: { name: string } }
export interface RingBody extends HandVtoBase { object_infos: Array<{ name: string; parameter: {
  ring_need_remove_background: boolean; ring_wearing_finger: 1 | 2 | 3 | 4 | 5; ring_wearing_location: number
  ring_shadow_intensity: number; ring_ambient_light_intensity: number; ring_anchor_point?: [Pt, Pt]
}}> }
export interface BraceletBody extends HandVtoBase { object_infos: Array<{ name: string; parameter: {
  bracelet_need_remove_background: boolean; bracelet_wearing_location: number
  bracelet_shadow_intensity: number; bracelet_ambient_light_intensity: number; bracelet_anchor_point?: [Pt, Pt]
}}> }
/** watch_anchor_point order (docs): [strap begin, strap end, case upper edge, case lower edge]. Omit for auto; null is rejected (400). */
export interface WatchBody extends HandVtoBase { object_infos: Array<{ name: string; parameter: {
  watch_need_remove_background: boolean; watch_wearing_location: number
  watch_shadow_intensity: number; watch_ambient_light_intensity: number; watch_anchor_point?: [Pt, Pt, Pt, Pt]
}}> }
export interface MakeupVtoBody {
  src_file_id?: string; src_file_url?: string; version: '1.0'
  effects: Array<{ category: 'skin_smooth' | 'lip_color'; skinSmoothStrength?: number; skinSmoothColorIntensity?: number
    shape?: { name: string }; morphology?: { fullness: number; wrinkless: number }
    palettes?: Array<{ color: string; texture: string; colorIntensity: number }>; style?: { type: string } }>
}
export interface HairTransferBody { src_file_id?: string; src_file_url?: string; template_id: string; parameters: { keep_hair_color: boolean } }
export interface SkinToneAnalysisBody { src_file_id?: string; src_file_url?: string }
export interface ClothV4Body { src_file_id?: string; src_file_url?: string; ref_file_id?: string; ref_file_url?: string; garment_category: 'upper_body' | 'lower_body' | 'full_body' | 'dress' }
export interface TextToImageBody { model: string; prompt: string; negative_prompt: string; size: string; prompt_extend: boolean }

type BodyFor<T extends YouCamFeature> =
  T extends '2d-vto/earring' ? EarringSingleBody | EarringStackBody :
  T extends '2d-vto/necklace' ? NecklaceBody :
  T extends '2d-vto/ring' ? RingBody :
  T extends '2d-vto/bracelet' ? BraceletBody :
  T extends '2d-vto/watch' ? WatchBody :
  T extends 'makeup-vto' ? MakeupVtoBody :
  T extends 'hair-transfer' ? HairTransferBody :
  T extends 'skin-tone-analysis' ? SkinToneAnalysisBody :
  T extends 'cloth-v4' ? ClothV4Body : TextToImageBody

type UploadSource = { bytes: Buffer; contentType: 'image/png' | 'image/jpeg'; fileName: string }
type FileRecord = { blob: string; contentType: UploadSource['contentType']; fileName: string; owner: string; fileId: string; createdAt?: string; expiresAt?: string }
type BlobIndex = { blob: string; createdAt: string }
const PRIVATE_RECOVERY_TTL_MS = 24 * 60 * 60 * 1000
const privateRecoveryName = (fileName: string) => /^(?:private-photo(?:$|[.-])|pipeline-input-|pipeline-|hair-input-)/i.test(fileName)
class CreditExhaustion extends AppError {}
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

export class YouCamClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fallbackKey: string
  private readonly persistence: StorageInstance
  private activeKey: string

  constructor(options: { apiKey?: string; fallbackKey?: string; baseUrl?: string; dataDir?: string; persistence?: StorageInstance } = {}) {
    this.baseUrl = options.baseUrl ?? env.YOUCAM_API_BASE
    this.apiKey = options.apiKey ?? env.YOUCAM_API_KEY
    this.fallbackKey = (options.fallbackKey ?? (options.apiKey ? '' : env.YOUCAM_API_KEY_FALLBACK) ?? '').trim()
    this.persistence = options.persistence ?? (options.dataDir ? createStorage({ rootDir: options.dataDir }) : defaultStorage)
    this.activeKey = this.apiKey
    if (!this.apiKey) throw new AppError(ErrorCodes.INVALID_KEY, 'YouCam API key is not configured', 500)
  }

  private get hasFallback() { return Boolean(this.fallbackKey && this.fallbackKey !== this.apiKey) }
  private resourcePath(kind: string, id: string) { return `youcam-resources/${kind}-${digest(id)}.json` }
  private async readRecord<T>(kind: string, id: string): Promise<T | null> {
    return this.persistence.getJson<T>(this.resourcePath(kind, id))
  }
  private async writeRecord(kind: string, id: string, value: unknown) {
    await this.persistence.putJson(this.resourcePath(kind, id), value)
  }

  // Register cached, pre-fallback file IDs without uploading or storing any API key.
  async rememberFile(fileId: string, load: () => Promise<UploadSource>): Promise<void> {
    if (!this.hasFallback || await this.readRecord('file', fileId)) return
    await this.saveFile(fileId, await load(), this.apiKey)
  }
  private async saveFile(fileId: string, source: UploadSource, apiKey: string, inheritedExpiry?: string) {
    if (!this.hasFallback) return
    const blob = digest(source.bytes)
    const createdAt = new Date().toISOString()
    const expiresAt = inheritedExpiry ?? (privateRecoveryName(source.fileName) ? new Date(Date.now() + PRIVATE_RECOVERY_TTL_MS).toISOString() : undefined)
    const blobIndexKey = this.resourcePath('blob', blob)
    if (!(await this.persistence.getJson<BlobIndex>(blobIndexKey))) await this.persistence.putJson(blobIndexKey, { blob, createdAt } satisfies BlobIndex)
    await this.persistence.putFile(`youcam-resources/${blob}.bin`, source.bytes)
    await this.writeRecord('file', fileId, { blob, contentType: source.contentType, fileName: source.fileName, owner: digest(apiKey), fileId, createdAt, ...(expiresAt ? { expiresAt } : {}) } satisfies FileRecord)
  }
  private async fileForKey(fileId: string, apiKey: string): Promise<string> {
    const record = await this.readRecord<FileRecord>('file', fileId)
    // Unregistered IDs predate fallback support and belong to the primary key.
    if (!record && apiKey === this.apiKey) return fileId
    if (!record) throw new AppError(ErrorCodes.TRYON_FAILED, 'Cached upload is unavailable; please upload the photo again.', 400)
    const recoveredRecord = await this.withPrivateExpiry(fileId, record)
    if (recoveredRecord.expiresAt && Date.parse(recoveredRecord.expiresAt) <= Date.now()) {
      await this.forgetFile(fileId)
      throw new AppError(ErrorCodes.TRYON_FAILED, 'Cached upload has expired; please upload the photo again.', 400)
    }
    if (recoveredRecord.owner === digest(apiKey)) return fileId
    const aliasId = `${fileId}:${digest(apiKey)}`
    const alias = await this.readRecord<{ fileId: string; expiresAt?: string }>('alias', aliasId)
    if (alias) return alias.fileId
    const bytes = await this.persistence.getFile(`youcam-resources/${recoveredRecord.blob}.bin`)
    if (!bytes) throw new AppError(ErrorCodes.TRYON_FAILED, 'Cached upload is unavailable; please upload the photo again.', 400)
    const mappedId = await this.uploadForKey(bytes, recoveredRecord.contentType, recoveredRecord.fileName, apiKey, recoveredRecord.expiresAt)
    await this.writeRecord('alias', aliasId, { sourceFileId: fileId, fileId: mappedId, ...(recoveredRecord.expiresAt ? { expiresAt: recoveredRecord.expiresAt } : {}) })
    return mappedId
  }

  private async withPrivateExpiry(fileId: string, record: FileRecord): Promise<FileRecord> {
    if (!privateRecoveryName(record.fileName) || record.expiresAt) return record
    const createdAt = record.createdAt ?? new Date().toISOString()
    const upgraded = { ...record, createdAt, expiresAt: new Date(Date.parse(createdAt) + PRIVATE_RECOVERY_TTL_MS).toISOString() }
    await this.writeRecord('file', fileId, upgraded)
    return upgraded
  }

  /** Remove server-side recovery data for a personal upload and its fallback-account copies. */
  async forgetFile(fileId: string): Promise<void> {
    const keys = await this.persistence.list?.('youcam-resources/') ?? []
    const records = await Promise.all(keys.filter(key => key.endsWith('.json')).map(async key => ({ key, value: await this.persistence.getJson<Record<string, unknown>>(key) })))
    const fileIds = new Set([fileId])
    const removeKeys = new Set<string>()

    // Alias records identify the personal source and the YouCam copy uploaded for the fallback account.
    for (const { key, value } of records) {
      if (!value || !key.includes('/alias-')) continue
      const sourceFileId = value.sourceFileId
      const mappedFileId = value.fileId
      if (sourceFileId === fileId && typeof mappedFileId === 'string') fileIds.add(mappedFileId)
      if (sourceFileId === fileId || (typeof mappedFileId === 'string' && fileIds.has(mappedFileId))) removeKeys.add(key)
    }

    const fileRecords = records.filter(({ key, value }) => key.includes('/file-') && value && typeof value.fileId === 'string')
    const blobsToConsider = new Set<string>()
    for (const { key, value } of fileRecords) {
      if (value && typeof value.fileId === 'string' && fileIds.has(value.fileId)) {
        removeKeys.add(key)
        if (typeof value.blob === 'string') blobsToConsider.add(value.blob)
      }
    }

    if (this.persistence.delete) {
      await Promise.all([...removeKeys].map(key => this.persistence.delete!(key)))
      const remainingBlobs = new Set(fileRecords
        .filter(({ key }) => !removeKeys.has(key))
        .map(({ value }) => value?.blob)
        .filter((blob): blob is string => typeof blob === 'string'))
      await Promise.all([...blobsToConsider].filter(blob => !remainingBlobs.has(blob)).flatMap(blob => [
        this.persistence.delete!(`youcam-resources/${blob}.bin`),
        this.persistence.delete!(this.resourcePath('blob', blob)),
      ]))
    }
  }

  /** Remove expired private recovery uploads and unindexed crash leftovers. */
  async cleanupExpiredFiles(now = new Date()): Promise<{ filesRemoved: number; bytesRemoved: number }> {
    const list = this.persistence.list
    if (!list || !this.persistence.delete) return { filesRemoved: 0, bytesRemoved: 0 }
    const keys = await list.call(this.persistence, 'youcam-resources/')
    const records = await Promise.all(keys.filter(key => key.endsWith('.json')).map(async key => ({ key, value: await this.persistence.getJson<Record<string, unknown>>(key) })))
    const fileEntries = records.filter(({ key, value }) => key.includes('/file-') && value && typeof value.fileId === 'string' && typeof value.fileName === 'string')
    const expiryByFileId = new Map<string, string>()
    const expiredIds = new Set<string>()
    for (const { key, value } of fileEntries) {
      if (!value || typeof value.fileId !== 'string' || typeof value.fileName !== 'string' || !privateRecoveryName(value.fileName)) continue
      let expiresAt = typeof value.expiresAt === 'string' ? value.expiresAt : undefined
      if (!expiresAt) {
        const createdAt = typeof value.createdAt === 'string' ? value.createdAt : now.toISOString()
        expiresAt = new Date(Date.parse(createdAt) + PRIVATE_RECOVERY_TTL_MS).toISOString()
        await this.persistence.putJson(key, { ...value, createdAt, expiresAt })
      }
      expiryByFileId.set(value.fileId, expiresAt)
      if (Date.parse(expiresAt) <= now.getTime()) expiredIds.add(value.fileId)
    }
    for (const { key, value } of records) {
      if (!value || !key.includes('/alias-')) continue
      const sourceFileId = typeof value.sourceFileId === 'string' ? value.sourceFileId : undefined
      const targetFileId = typeof value.fileId === 'string' ? value.fileId : undefined
      const inheritedExpiry = (sourceFileId && expiryByFileId.get(sourceFileId)) || (targetFileId && expiryByFileId.get(targetFileId))
      const expiresAt = typeof value.expiresAt === 'string' ? value.expiresAt : inheritedExpiry
      if (!value.expiresAt && expiresAt) await this.persistence.putJson(key, { ...value, expiresAt })
      if (expiresAt && Date.parse(expiresAt) <= now.getTime()) {
        if (sourceFileId) expiredIds.add(sourceFileId)
        else if (targetFileId) expiredIds.add(targetFileId)
      }
    }
    for (const fileId of expiredIds) await this.forgetFile(fileId)

    // A crash can leave a blob/index pair before its file record is written.
    const currentKeys = await list.call(this.persistence, 'youcam-resources/')
    const currentRecords = await Promise.all(currentKeys.filter(key => key.endsWith('.json')).map(async key => ({ key, value: await this.persistence.getJson<Record<string, unknown>>(key) })))
    const referenced = new Set(currentRecords
      .filter(({ key, value }) => key.includes('/file-') && value && typeof value.blob === 'string')
      .map(({ value }) => value?.blob as string))
    let bytesRemoved = 0
    for (const { key, value } of currentRecords) {
      if (!key.includes('/blob-') || !value || typeof value.blob !== 'string' || typeof value.createdAt !== 'string') continue
      const age = now.getTime() - Date.parse(value.createdAt)
      if (age < PRIVATE_RECOVERY_TTL_MS || referenced.has(value.blob)) continue
      const bytes = await this.persistence.getFile(`youcam-resources/${value.blob}.bin`)
      if (bytes) bytesRemoved += bytes.length
      await this.persistence.delete(`youcam-resources/${value.blob}.bin`)
      await this.persistence.delete(key)
    }
    return { filesRemoved: expiredIds.size, bytesRemoved }
  }
  private async bodyForKey(body: unknown, apiKey: string): Promise<unknown> {
    if (!this.hasFallback || !body || typeof body !== 'object') return body
    const mapped = { ...body } as Record<string, any>
    for (const field of ['src_file_id', 'ref_file_id']) {
      if (typeof mapped[field] === 'string') mapped[field] = await this.fileForKey(mapped[field], apiKey)
    }
    for (const field of ['ref_file_ids']) {
      if (Array.isArray(mapped[field])) mapped[field] = await Promise.all(mapped[field].map((id: string) => this.fileForKey(id, apiKey)))
    }
    return mapped
  }

  private async request<T>(method: string, endpoint: string, body?: unknown, apiKey = this.apiKey): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      for (let attempt = 0; attempt <= 3; attempt++) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        })
        if (response.status === 429 && attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000))
          continue
        }
        if (response.status === 401) throw new AppError(ErrorCodes.INVALID_KEY, 'Invalid API key', 401)
        const data = await response.json() as any
        if (!response.ok && data?.error?.error_code === 'CreditInsufficiency') {
          throw new CreditExhaustion(ErrorCodes.TRYON_FAILED, 'YouCam API credits exhausted', response.status)
        }
        if (!response.ok) throw new AppError(ErrorCodes.TRYON_FAILED, `YouCam API error: ${data?.error?.message || data?.message || `HTTP ${response.status}`}`, response.status)
        return data as T
      }
      throw new AppError(ErrorCodes.TRYON_FAILED, 'YouCam request failed', 500)
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(ErrorCodes.INTERNAL_ERROR, `Request failed: ${error instanceof Error ? error.message : String(error)}`, 500)
    } finally { clearTimeout(timeout) }
  }

  async getBalance(): Promise<number> {
    try {
      const selected = await this.selectAccount()
      this.activeKey = selected.apiKey
      return selected.balance
    } catch (error) {
      if (error instanceof AppError && error.code === ErrorCodes.INVALID_KEY) throw error
      throw new AppError(ErrorCodes.INTERNAL_ERROR, `Failed to get balance: ${error instanceof Error ? error.message : String(error)}`, 500)
    }
  }

  async getBudgetSnapshot(): Promise<{ balance: number; accountId: string }> {
    const selected = await this.selectAccount()
    this.activeKey = selected.apiKey
    return { balance: selected.balance, accountId: digest(selected.apiKey) }
  }

  private async selectAccount(): Promise<{ apiKey: string; balance: number }> {
    const primary = await this.balanceForKey(this.apiKey)
    if (primary <= 0 && this.hasFallback) {
      return { apiKey: this.fallbackKey, balance: await this.balanceForKey(this.fallbackKey) }
    }
    return { apiKey: this.apiKey, balance: primary }
  }

  private async balanceForKey(apiKey: string) {
    const response = await this.request<{ results: CreditEntry[] }>('GET', '/s2s/v1.0/client/credit', undefined, apiKey)
    const balance = response.results.filter(entry => entry.type.startsWith('Api')).reduce((sum, entry) => sum + entry.amount, 0)
    if (!Number.isFinite(balance)) throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Invalid credit balance response', 500)
    return balance
  }

  async uploadFile(bytes: Buffer, contentType: 'image/png' | 'image/jpeg', fileName: string): Promise<string> {
    return this.uploadForKey(bytes, contentType, fileName, this.activeKey)
  }

  private async uploadForKey(bytes: Buffer, contentType: 'image/png' | 'image/jpeg', fileName: string, apiKey: string, recoveryExpiry?: string): Promise<string> {
    try {
      const response = await this.request<{ status: number; data: { files: UploadResponse[] } }>('POST', '/s2s/v2.0/file', {
        files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }],
      }, apiKey)
      const fileInfo = response.data.files[0]
      if (!fileInfo?.requests?.[0]) throw new AppError(ErrorCodes.TRYON_FAILED, 'Invalid upload response', 500)
      const upload = fileInfo.requests[0]
      const headers = { ...upload.headers }
      for (const name of Object.keys(headers)) if (name.toLowerCase() === 'authorization') delete headers[name]
      const putResponse = await fetch(upload.url, { method: 'PUT', headers, body: bytes as any })
      if (!putResponse.ok) throw new AppError(ErrorCodes.TRYON_FAILED, `S3 upload failed: HTTP ${putResponse.status}`, 500)
      await this.saveFile(fileInfo.file_id, { bytes, contentType, fileName }, apiKey, recoveryExpiry)
      return fileInfo.file_id
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(ErrorCodes.TRYON_FAILED, `Upload failed: ${error instanceof Error ? error.message : String(error)}`, 500)
    }
  }

  async createTask<T extends YouCamFeature>(feature: T, body: BodyFor<T>): Promise<string> {
    // Keep the selection local: concurrent balance reads must not change this task's key.
    let { balance, apiKey } = this.hasFallback ? await this.selectAccount() : { balance: undefined, apiKey: this.apiKey }
    const units = feature === 'hair-transfer' || feature === 'cloth-v4' || (feature === '2d-vto/earring' && (body as EarringSingleBody).object_infos?.length > 1) ? 2 : 1
    const checkReserve = () => {
      if (balance !== undefined && balance - units < env.UNIT_RESERVE_FLOOR) {
        throw new AppError(ErrorCodes.BUDGET_RESERVED, 'Credits are below the demo reserve', 503, 'Try-on is paused to save demo credits. Please use the sample photo.')
      }
    }
    checkReserve()
    let response: { data: TaskResponse }
    try {
      response = await this.request('POST', YOUCAM_ENDPOINTS[feature], await this.bodyForKey(body, apiKey), apiKey)
    } catch (error) {
      // A concurrent spender may have drained the primary since the balance check.
      // Retry only an explicit credit rejection with a freshly confirmed zero balance.
      if (!(error instanceof CreditExhaustion) || apiKey !== this.apiKey || !this.hasFallback) throw error
      const selected = await this.selectAccount()
      if (selected.apiKey !== this.fallbackKey) throw error
      balance = selected.balance
      apiKey = selected.apiKey
      checkReserve()
      response = await this.request('POST', YOUCAM_ENDPOINTS[feature], await this.bodyForKey(body, apiKey), apiKey)
    }
    if (this.hasFallback) await this.writeRecord('task', response.data.task_id, { owner: digest(apiKey) })
    return response.data.task_id
  }

  async getTask(feature: YouCamFeature, taskId: string): Promise<{ status: 'running' | 'success' | 'error'; resultUrl?: string; errorMessage?: string; raw: unknown }> {
    const owner = this.hasFallback ? await this.readRecord<{ owner: string }>('task', taskId) : null
    const apiKey = owner?.owner === digest(this.fallbackKey) && this.hasFallback ? this.fallbackKey : this.apiKey
    if (owner && owner.owner !== digest(apiKey)) throw new AppError(ErrorCodes.INVALID_KEY, 'The key that created this task is no longer configured', 500)
    const response = await this.request<{ status: number; data: TaskStatusResponse }>('GET', `${YOUCAM_ENDPOINTS[feature]}/${encodeURIComponent(taskId)}`, undefined, apiKey)
    const data = response.data
    const results = Array.isArray(data.results) ? data.results[0] : data.results
    return {
      status: data.task_status,
      resultUrl: results?.url || results?.download_url,
      errorMessage: data.error?.message,
      raw: data,
    }
  }

  async createEarringTask(input: { src: { fileId?: string; url?: string }; ref: { fileId?: string; url?: string }; scaleCm: number; rightEar: boolean; occluded: 0 | 1 | 2; wearingLocation?: [number, number]; anchorPoint?: [number, number] }): Promise<string> {
    if (input.scaleCm <= 0.3 || input.scaleCm > 15) throw new AppError(ErrorCodes.INVALID_INPUT, `scaleCm must be between 0.3 and 15, got ${input.scaleCm}`, 400)
    const body: EarringSingleBody = { source_info: { name: 'face' }, object_infos: [{ name: 'gen_earring.png', parameter: {
      earring_need_remove_background: true, earring_scale: input.scaleCm, earring_is_right_ear: input.rightEar,
      earring_occluded_type: input.occluded, earring_shadow_intensity: 0.5, earring_ambient_light_intensity: 0.5,
      ...(input.wearingLocation ? { earring_wearing_location: input.wearingLocation } : {}),
      ...(input.anchorPoint ? { earring_anchor_point: [input.anchorPoint] } : {}),
    } }] }
    if (input.src.fileId) body.src_file_id = input.src.fileId; else if (input.src.url) body.src_file_url = input.src.url; else throw new AppError(ErrorCodes.INVALID_INPUT, 'Either src.fileId or src.url is required', 400)
    if (input.ref.fileId) body.ref_file_ids = [input.ref.fileId]; else if (input.ref.url) body.ref_file_urls = [input.ref.url]; else throw new AppError(ErrorCodes.INVALID_INPUT, 'Either ref.fileId or ref.url is required', 400)
    return this.createTask('2d-vto/earring', body)
  }

  async createEarringStackTask(input: { src: { fileId?: string; url?: string }; refs: Array<{ fileId?: string; url?: string }>; placements: Array<{ scaleCm: number; wearingLocation?: [number, number]; anchorPoint?: [number, number] }>; rightEar: boolean; occluded: 0 | 1 | 2 }): Promise<string> {
    if (!input.placements.length || input.refs.length !== input.placements.length) throw new AppError(ErrorCodes.INVALID_INPUT, 'Stack refs and placements must have equal non-zero lengths', 400)
    const body: EarringStackBody = { source_info: { name: 'gen_face.png' }, object_infos: input.placements.map(p => ({ name: 'gen_earring.png', parameter: {
      earring_need_remove_background: true, earring_wearing_location: p.wearingLocation || [375, 660], earring_scale: p.scaleCm,
      earring_is_right_ear: input.rightEar, earring_occluded_type: input.occluded, earring_shadow_intensity: 0.5, earring_ambient_light_intensity: 0.5,
      ...(p.anchorPoint ? { earring_anchor_point: [p.anchorPoint] } : {}),
    } })) }
    if (input.src.fileId) body.src_file_id = input.src.fileId; else if (input.src.url) body.src_file_url = input.src.url; else throw new AppError(ErrorCodes.INVALID_INPUT, 'Either src.fileId or src.url is required', 400)
    const fileIds = input.refs.map(ref => ref.fileId)
    if (fileIds.every((id): id is string => Boolean(id))) body.ref_file_ids = fileIds as string[]
    else if (input.refs.every(ref => Boolean(ref.url))) body.ref_file_urls = input.refs.map(ref => ref.url!)
    else throw new AppError(ErrorCodes.INVALID_INPUT, 'All refs must use the same source form', 400)
    return this.createTask('2d-vto/earring', body)
  }

  async createNecklaceTask(input: { src: { fileId?: string; url?: string }; ref: { fileId?: string; url?: string }; wearingLocation?: [[number, number], [number, number]]; anchorPoint?: [[number, number], [number, number]] }): Promise<string> {
    const body: NecklaceBody = { source_info: { name: 'gen_face.png' }, object_infos: [{ name: 'gen_necklace.png', parameter: {
      necklace_need_remove_background: true, necklace_shadow_intensity: 0.5, necklace_ambient_light_intensity: 0.5,
      ...(input.wearingLocation ? { necklace_wearing_location: input.wearingLocation } : {}), ...(input.anchorPoint ? { necklace_anchor_point: input.anchorPoint } : {}),
    } }] }
    if (input.src.fileId) body.src_file_id = input.src.fileId; else if (input.src.url) body.src_file_url = input.src.url; else throw new AppError(ErrorCodes.INVALID_INPUT, 'Either src.fileId or src.url is required', 400)
    if (input.ref.fileId) body.ref_file_ids = [input.ref.fileId]; else if (input.ref.url) body.ref_file_urls = [input.ref.url]; else throw new AppError(ErrorCodes.INVALID_INPUT, 'Either ref.fileId or ref.url is required', 400)
    return this.createTask('2d-vto/necklace', body)
  }

  async createMakeupTask(input: { src: { fileId?: string; url?: string }; lip: { hex: string; texture: string; intensity: number } }): Promise<string> {
    if (input.lip.intensity < 0 || input.lip.intensity > 100) throw new AppError(ErrorCodes.INVALID_INPUT, 'lip.intensity must be between 0 and 100', 400)
    const body: MakeupVtoBody = { version: '1.0', effects: [
      { category: 'skin_smooth', skinSmoothStrength: 0, skinSmoothColorIntensity: 0 },
      { category: 'lip_color', shape: { name: 'original' }, morphology: { fullness: 50, wrinkless: 50 }, palettes: [{ color: input.lip.hex, texture: input.lip.texture, colorIntensity: input.lip.intensity }], style: { type: 'full' } },
    ] }
    if (input.src.fileId) body.src_file_id = input.src.fileId; else if (input.src.url) body.src_file_url = input.src.url; else throw new AppError(ErrorCodes.INVALID_INPUT, 'Either src.fileId or src.url is required', 400)
    return this.createTask('makeup-vto', body)
  }

  async createHairTask(input: { src: { fileId?: string; url?: string }; templateId: string; keepUserColour: boolean }): Promise<string> {
    const body: HairTransferBody = { template_id: input.templateId, parameters: { keep_hair_color: input.keepUserColour } }
    if (input.src.fileId) body.src_file_id = input.src.fileId; else if (input.src.url) body.src_file_url = input.src.url; else throw new AppError(ErrorCodes.INVALID_INPUT, 'Either src.fileId or src.url is required', 400)
    return this.createTask('hair-transfer', body)
  }

  async createSkinToneTask(input: { src: { fileId?: string; url?: string } }): Promise<string> {
    const body: SkinToneAnalysisBody = {}
    if (input.src.fileId) body.src_file_id = input.src.fileId; else if (input.src.url) body.src_file_url = input.src.url; else throw new AppError(ErrorCodes.INVALID_INPUT, 'Either src.fileId or src.url is required', 400)
    return this.createTask('skin-tone-analysis', body)
  }

  async createClothTask(input: { src: { fileId?: string; url?: string }; ref: { fileId?: string; url?: string }; garmentCategory: 'upper_body' | 'lower_body' | 'full_body' | 'dress' }): Promise<string> {
    const body: ClothV4Body = { garment_category: input.garmentCategory }
    if (input.src.fileId) body.src_file_id = input.src.fileId; else if (input.src.url) body.src_file_url = input.src.url; else throw new AppError(ErrorCodes.INVALID_INPUT, 'Either src.fileId or src.url is required', 400)
    if (input.ref.fileId) body.ref_file_id = input.ref.fileId; else if (input.ref.url) body.ref_file_url = input.ref.url; else throw new AppError(ErrorCodes.INVALID_INPUT, 'Either ref.fileId or ref.url is required', 400)
    return this.createTask('cloth-v4', body)
  }

  async listHairTemplates(options?: { startingToken?: string; limit?: number }): Promise<{ templates: HairTemplate[]; startingToken?: string }> {
    const params = new URLSearchParams()
    if (options?.startingToken) params.set('starting_token', options.startingToken)
    params.set('page_size', String(options?.limit ?? 20))
    const endpoint = `/s2s/v2.1/task/template/hair-transfer?${params}`
    const response = await this.request<{ status: number; data: { templates?: Array<Record<string, unknown>>; starting_token?: string } }>('GET', endpoint)
    const templates = (response.data.templates ?? []).flatMap((item): HairTemplate[] => {
      const id = typeof item.template_id === 'string' ? item.template_id : typeof item.id === 'string' ? item.id : ''
      const title = typeof item.title === 'string' ? item.title : ''
      const thumb = typeof item.thumb === 'string' ? item.thumb : typeof item.cover === 'string' ? item.cover : ''
      if (!id || !title) return []
      const keepsColour = item.keep_users_color === true || item.supports_hair_color === true
      return [{ template_id: id, id, title, cover: thumb, thumb, style: typeof item.style === 'string' ? item.style : undefined, keep_users_color: keepsColour } as HairTemplate]
    })
    return { templates, startingToken: response.data.starting_token }
  }

  async createTextToImageTask(input: { prompt: string; negativePrompt?: string; size?: string; model?: string; promptExtend?: boolean }): Promise<string> {
    const body: TextToImageBody = { model: input.model || 'youcam-image-v2', prompt: input.prompt, negative_prompt: input.negativePrompt || 'blurry, low quality, distorted, watermark, text', size: input.size || '1328*1328', prompt_extend: input.promptExtend ?? true }
    return this.createTask('text-to-image', body)
  }
}

export const youcam = new YouCamClient()
export const rememberFile = (fileId: string, load: () => Promise<UploadSource>) => youcam.rememberFile(fileId, load)
export const forgetFile = (fileId: string) => youcam.forgetFile(fileId)
export const cleanupExpiredFiles = (now?: Date) => youcam.cleanupExpiredFiles(now)
export const getBalance = () => youcam.getBalance()
export const getBudgetSnapshot = () => youcam.getBudgetSnapshot()
export const uploadFile = (bytes: Buffer, contentType: 'image/png' | 'image/jpeg', fileName: string) => youcam.uploadFile(bytes, contentType, fileName)
export const createTask = <T extends YouCamFeature>(feature: T, body: BodyFor<T>) => youcam.createTask(feature, body)
export const getTask = (feature: YouCamFeature, taskId: string) => youcam.getTask(feature, taskId)
export const createEarringTask = (input: Parameters<YouCamClient['createEarringTask']>[0]) => youcam.createEarringTask(input)
export const createEarringStackTask = (input: Parameters<YouCamClient['createEarringStackTask']>[0]) => youcam.createEarringStackTask(input)
export const createNecklaceTask = (input: Parameters<YouCamClient['createNecklaceTask']>[0]) => youcam.createNecklaceTask(input)
export const createMakeupTask = (input: Parameters<YouCamClient['createMakeupTask']>[0]) => youcam.createMakeupTask(input)
export const createHairTask = (input: Parameters<YouCamClient['createHairTask']>[0]) => youcam.createHairTask(input)
export const createSkinToneTask = (input: Parameters<YouCamClient['createSkinToneTask']>[0]) => youcam.createSkinToneTask(input)
export const createClothTask = (input: Parameters<YouCamClient['createClothTask']>[0]) => youcam.createClothTask(input)
export const createTextToImageTask = (input: Parameters<YouCamClient['createTextToImageTask']>[0]) => youcam.createTextToImageTask(input)
