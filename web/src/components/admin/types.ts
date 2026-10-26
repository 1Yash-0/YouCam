export interface HealthData {
  authenticated?: boolean
  ok: boolean
  units?: number
  reserveFloor?: number
  keyValid?: boolean
  code?: string
  message?: string
}

export interface ProductFormData {
  id: string
  name: string
  brand: string
  type: 'single' | 'stud' | 'necklace' | 'garment'
  priceUsd: string
  heightCm: string
  widthCm: string
  lengthCm: string
  metal: string
  garmentCategory: 'upper_body' | 'lower_body' | 'full_body' | 'outer'
  sizes: string
  anchorPoint: string
  imageFile: File | null
}

