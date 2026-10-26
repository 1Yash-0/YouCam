/**
 * Typed frontend API client for Darpan backend routes.
 * Matching server schemas defined in web/src/lib/ and web/src/app/api/.
 */

export type ProductType = 'single' | 'stud' | 'necklace' | 'garment'

export interface BaseProduct {
  id: string
  name: string
  brand: string
  type: ProductType
  priceUsd: number
  imagePath: string
  source: string
  licence: string
}

export interface SingleEarringProduct extends BaseProduct {
  type: 'single'
  heightCm: number
  widthCm: number
  metal: string
  anchorPoint?: [number, number]
  sizes?: number[]
}

export interface StudProduct extends BaseProduct {
  type: 'stud'
  heightCm: number
  widthCm: number
  metal: string
  anchorPoint?: [number, number]
  sizes?: number[]
}

export interface NecklaceProduct extends BaseProduct {
  type: 'necklace'
  lengthCm: number
}

export interface GarmentProduct extends BaseProduct {
  type: 'garment'
  garmentCategory: 'upper_body' | 'lower_body' | 'full_body' | 'outer'
}

export type Product = SingleEarringProduct | StudProduct | NecklaceProduct | GarmentProduct

export interface HealthResponse {
  ok: boolean
  units?: number
  reserveFloor?: number
  keyValid?: boolean
  code?: string
  message?: string
}

export interface UploadPhotoResponse {
  photoId: string
  width: number
  height: number
}

export interface TryOnStackItem {
  productId: string
  sizeCm: number
  wearingLocation: [number, number]
}

export interface TryOnOptions {
  hairUp?: { templateId: string }
  lipstick?: { hex: string; texture: string; intensity: number }
  outfit?: { productId: string }
}

export interface TryOnRequestBody {
  photoId: string
  productId: string
  sizeCm?: number
  ear?: 'right' | 'left'
  occluded?: 0 | 1 | 2
  wearingLocation?: [number, number]
  irisPx?: number
  flow?: 'ear' | 'neck' | 'hand'
  finger?: 1 | 2 | 3 | 4 | 5
  /** Rings: wearer's US ring size (default 7) so the stone renders at its real size on their finger */
  ringSizeUs?: number
  stack?: TryOnStackItem[]
  options?: TryOnOptions
}

export interface TryOnStepInfo {
  type: 'earring' | 'stack' | 'necklace' | 'ring' | 'bracelet' | 'watch' | 'makeup' | 'hair' | 'cloth'
  units: number
  cached: boolean
}

export interface TryOnMeasurement {
  earringHeightPx?: number
  earringHeightMm?: number
  pixelRatio?: number
  confidence?: number
  lobeCoordinates?: [number, number]
  tipCoordinates?: [number, number]
  [key: string]: unknown
}

export interface TryOnResultData {
  key: string
  imageUrl: string
  flow: 'ear' | 'neck' | 'hand'
  steps: TryOnStepInfo[]
  unitsSpent: number
  measurement?: TryOnMeasurement
  identityNote?: string
}

export interface TryOnJobRunning {
  status: 'running'
  jobId: string
  step?: string
  stepIndex?: number
  totalSteps?: number
}

export interface TryOnJobDone {
  status: 'done'
  result: TryOnResultData
}

export interface TryOnJobError {
  status: 'error'
  code: string
  userMessage?: string
  message?: string
  step?: string
}

export type CreateTryOnResponse = TryOnJobRunning | TryOnJobDone
export type PollTryOnResponse = TryOnJobRunning | TryOnJobDone | TryOnJobError

export interface SampleLook {
  id: string
  title: string
  flow: string
  productId: string
  sizeCm: number
  steps: string[]
  imageUrl: string
}

export class ApiClientError extends Error {
  readonly code: string
  readonly status: number
  readonly userMessage?: string

  constructor(message: string, status: number, code: string = 'API_ERROR', userMessage?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.userMessage = userMessage || message
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!res.ok) {
    let code = 'HTTP_' + res.status
    let message = `Request failed with status ${res.status}`
    let userMessage = message

    try {
      const errData = await res.json()
      if (errData.code) code = errData.code
      if (errData.userMessage) userMessage = errData.userMessage
      if (errData.message) message = errData.message
    } catch {
      // not JSON error
    }

    throw new ApiClientError(message, res.status, code, userMessage)
  }

  return (await res.json()) as T
}

export const apiClient = {
  /**
   * Health & balance check
   * GET /api/health
   */
  async getHealth(): Promise<HealthResponse> {
    return requestJson<HealthResponse>('/api/health')
  },

  /**
   * Product catalogue
   * GET /api/products
   */
  async getProducts(): Promise<Product[]> {
    return requestJson<Product[]>('/api/products')
  },

  /**
   * Upload user photo
   * POST /api/photo
   */
  async uploadPhoto(file: File): Promise<UploadPhotoResponse> {
    const formData = new FormData()
    formData.append('photo', file)

    return requestJson<UploadPhotoResponse>('/api/photo', {
      method: 'POST',
      body: formData,
    })
  },

  /**
   * Create or resume a try-on pipeline job
   * POST /api/tryon
   */
  async createTryOn(body: TryOnRequestBody): Promise<CreateTryOnResponse> {
    return requestJson<CreateTryOnResponse>('/api/tryon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  },

  /**
   * Poll a running try-on job
   * GET /api/tryon/[jobId]
   */
  async pollTryOn(jobId: string): Promise<PollTryOnResponse> {
    return requestJson<PollTryOnResponse>(`/api/tryon/${encodeURIComponent(jobId)}`)
  },

  /**
   * Get direct URL string for a result key
   */
  getResultImage(key: string): string {
    return `/api/result/${encodeURIComponent(key)}`
  },

  /**
   * Get sample looks
   * GET /api/sample
   */
  async getSamples(): Promise<SampleLook[]> {
    return requestJson<SampleLook[]>('/api/sample')
  },
}

export const getHealth = apiClient.getHealth
export const getProducts = apiClient.getProducts
export const uploadPhoto = apiClient.uploadPhoto
export const createTryOn = apiClient.createTryOn
export const pollTryOn = apiClient.pollTryOn
export const getResultImage = apiClient.getResultImage
export const getSamples = apiClient.getSamples

