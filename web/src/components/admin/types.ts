import { Product } from '@/lib/products'

export interface HealthData {
  ok: boolean
  units?: number
  reserveFloor?: number
  keyValid?: boolean
  code?: string
  message?: string
}

export type ReferenceStandard = 'coin' | 'card' | 'grid'

export interface ProductFormData {
  id: string
  name: string
  brand: string
  type: 'single' | 'stud' | 'necklace' | 'garment'
  priceInr: string
  heightCm: string
  widthCm: string
  lengthCm: string
  metal: string
  garmentCategory: 'upper_body' | 'lower_body' | 'full_body' | 'outer'
  sizes: string
  anchorPoint: string
  imageFile: File | null
}
