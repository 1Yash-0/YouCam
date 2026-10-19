import { Product } from '@/lib/products'
import { HealthData } from './types'

export async function fetchHealth(): Promise<HealthData> {
  const res = await fetch('/api/health')
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    return {
      ok: false,
      code: errorData.code || 'HTTP_ERROR',
      message: errorData.message || `Health check failed with HTTP ${res.status}`,
    }
  }
  return res.json()
}

export async function fetchAllProducts(): Promise<Product[]> {
  const res = await fetch('/api/products')
  if (!res.ok) {
    throw new Error(`Failed to fetch products: ${res.statusText}`)
  }
  return res.json()
}

export async function createProduct(
  formData: FormData,
  token: string
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const cleanToken = token.trim()
  const res = await fetch('/api/admin/products', {
    method: 'POST',
    headers: {
      'x-admin-token': cleanToken,
    },
    body: formData,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      error: json.message || json.errors?.[0]?.message || `Error ${res.status}: Failed to create product`,
    }
  }

  return { ok: true, data: json }
}

export async function deleteProduct(
  id: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanToken = token.trim()
  const res = await fetch(`/api/admin/products/${id}`, {
    method: 'DELETE',
    headers: {
      'x-admin-token': cleanToken,
    },
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      error: json.message || `Error ${res.status}: Failed to delete product`,
    }
  }

  return { ok: true }
}
