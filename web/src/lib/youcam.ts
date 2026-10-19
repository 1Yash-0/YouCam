import { env } from './env'
import { AppError, ErrorCodes } from './errors'

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
  | 'makeup-vto'
  | 'hair-transfer'
  | 'cloth-v4'
  | 'skin-tone-analysis'
  | 'text-to-image'

export const YOUCAM_ENDPOINTS: Record<YouCamFeature, string> = {
  '2d-vto/earring': '/s2s/v2.0/task/2d-vto/earring',
  '2d-vto/necklace': '/s2s/v2.0/task/2d-vto/necklace',
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
  T extends 'makeup-vto' ? MakeupVtoBody :
  T extends 'hair-transfer' ? HairTransferBody :
  T extends 'skin-tone-analysis' ? SkinToneAnalysisBody :
  T extends 'cloth-v4' ? ClothV4Body : TextToImageBody

class YouCamClient {
  private readonly baseUrl = env.YOUCAM_API_BASE
  private readonly apiKey = env.YOUCAM_API_KEY

  constructor() {
    if (!this.apiKey) throw new AppError(ErrorCodes.INVALID_KEY, 'YouCam API key is not configured', 500)
  }

  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      for (let attempt = 0; attempt <= 3; attempt++) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        })
        if (response.status === 429 && attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000))
          continue
        }
        if (response.status === 401) throw new AppError(ErrorCodes.INVALID_KEY, 'Invalid API key', 401)
        const data = await response.json() as any
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
      const response = await this.request<{ status: number; results: CreditEntry[] }>('GET', '/s2s/v1.0/client/credit')
      return response.results.filter(entry => entry.type.startsWith('Api')).reduce((sum, entry) => sum + entry.amount, 0)
    } catch (error) {
      if (error instanceof AppError && error.code === ErrorCodes.INVALID_KEY) throw error
      throw new AppError(ErrorCodes.INTERNAL_ERROR, `Failed to get balance: ${error instanceof Error ? error.message : String(error)}`, 500)
    }
  }

  async uploadFile(bytes: Buffer, contentType: 'image/png' | 'image/jpeg', fileName: string): Promise<string> {
    try {
      const response = await this.request<{ status: number; data: { files: UploadResponse[] } }>('POST', '/s2s/v2.0/file', {
        files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }],
      })
      const fileInfo = response.data.files[0]
      if (!fileInfo?.requests?.[0]) throw new AppError(ErrorCodes.TRYON_FAILED, 'Invalid upload response', 500)
      const upload = fileInfo.requests[0]
      const headers = { ...upload.headers }
      delete headers.Authorization
      const putResponse = await fetch(upload.url, { method: 'PUT', headers, body: bytes as any })
      if (!putResponse.ok) throw new AppError(ErrorCodes.TRYON_FAILED, `S3 upload failed: HTTP ${putResponse.status}`, 500)
      return fileInfo.file_id
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(ErrorCodes.TRYON_FAILED, `Upload failed: ${error instanceof Error ? error.message : String(error)}`, 500)
    }
  }

  async createTask<T extends YouCamFeature>(feature: T, body: BodyFor<T>): Promise<string> {
    const response = await this.request<{ status: number; data: TaskResponse }>('POST', YOUCAM_ENDPOINTS[feature], body)
    return response.data.task_id
  }

  async getTask(feature: YouCamFeature, taskId: string): Promise<{ status: 'running' | 'success' | 'error'; resultUrl?: string; errorMessage?: string; raw: unknown }> {
    const response = await this.request<{ status: number; data: TaskStatusResponse }>('GET', `${YOUCAM_ENDPOINTS[feature]}/${taskId}`)
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
    if (options?.limit) params.set('limit', String(options.limit))
    const endpoint = `/s2s/v2.1/hair/templates${params.toString() ? `?${params}` : ''}`
    const response = await this.request<{ status: number; data: HairTemplatesResponse }>('GET', endpoint)
    return { templates: response.data.templates || [], startingToken: response.data.starting_token }
  }

  async createTextToImageTask(input: { prompt: string; negativePrompt?: string; size?: string; model?: string; promptExtend?: boolean }): Promise<string> {
    const body: TextToImageBody = { model: input.model || 'youcam-image-v2', prompt: input.prompt, negative_prompt: input.negativePrompt || 'blurry, low quality, distorted, watermark, text', size: input.size || '1328*1328', prompt_extend: input.promptExtend ?? true }
    return this.createTask('text-to-image', body)
  }
}

export const youcam = new YouCamClient()
export const getBalance = () => youcam.getBalance()
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
