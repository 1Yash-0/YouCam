import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/admin/products/route'
import { PATCH, DELETE } from '@/app/api/admin/products/[id]/route'
import { NextRequest } from 'next/server'

// Mock the admin module
vi.mock('@/lib/admin', () => ({
  withAdminAuth: vi.fn((request, handler) => handler(request)),
  verifyAdminToken: vi.fn(),
}))

// Mock storage
vi.mock('@/lib/storage', () => ({
  getJson: vi.fn(),
  putJson: vi.fn(),
  getFile: vi.fn(),
  runtimeProductsPath: () => 'products.json',
  runtimeProductImagePath: (id: string) => `products/${id}.png`,
  productMetaPath: (id: string) => `meta/products/${id}.json`,
}))

// Mock runtime products
vi.mock('@/lib/runtime-products', () => ({
  createRuntimeProduct: vi.fn(),
  updateRuntimeProduct: vi.fn(),
  deleteRuntimeProduct: vi.fn(),
  getAllProductsWithRuntime: vi.fn(),
  getProductWithRuntime: vi.fn(),
  isRuntimeProduct: vi.fn(),
}))

describe('Admin Product Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/admin/products', () => {
    it('should create a runtime product with valid data', async () => {
      const { createRuntimeProduct } = await import('@/lib/runtime-products')
      
      // Mock successful creation
      vi.mocked(createRuntimeProduct).mockResolvedValue({
        id: 'test-product',
        name: 'Test Product',
        brand: 'Test Brand',
        type: 'single',
        heightCm: 3,
        widthCm: 2,
        metal: 'silver',
        priceInr: 999,
        imagePath: '/products/test-product.png',
        source: 'Runtime addition',
        licence: 'Runtime addition',
      })

      const formData = new FormData()
      formData.append('id', 'test-product')
      formData.append('name', 'Test Product')
      formData.append('brand', 'Test Brand')
      formData.append('type', 'single')
      formData.append('priceInr', '999')
      formData.append('heightCm', '3')
      formData.append('widthCm', '2')
      formData.append('metal', 'silver')
      
      // Create a mock image file
      const blob = new Blob(['fake image data'], { type: 'image/png' })
      formData.append('image', blob, 'test.png')

      const request = new NextRequest('http://localhost/api/admin/products', {
        method: 'POST',
        headers: {
          'x-admin-token': 'test-admin-token',
        },
        body: formData,
      })

      const response = await POST(request)
      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.id).toBe('test-product')
      expect(data.message).toContain('created successfully')
    })

    it('should return 400 when image file is missing', async () => {
      const formData = new FormData()
      formData.append('id', 'test-product')
      formData.append('name', 'Test Product')
      formData.append('brand', 'Test Brand')
      formData.append('type', 'single')
      formData.append('priceInr', '999')
      formData.append('heightCm', '3')
      formData.append('widthCm', '2')

      const request = new NextRequest('http://localhost/api/admin/products', {
        method: 'POST',
        headers: {
          'x-admin-token': 'test-admin-token',
        },
        body: formData,
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.code).toBe('INVALID_INPUT')
    })

    it('should return 409 when product ID already exists', async () => {
      const { createRuntimeProduct } = await import('@/lib/runtime-products')
      
      // Mock ID collision - create an error object with code property
      const error = new Error('Product ID already exists')
      ;(error as any).code = 'INVALID_INPUT'
      ;(error as any).statusCode = 409
      vi.mocked(createRuntimeProduct).mockRejectedValue(error)

      const formData = new FormData()
      formData.append('id', 'existing-product')
      formData.append('name', 'Test Product')
      formData.append('brand', 'Test Brand')
      formData.append('type', 'single')
      formData.append('priceInr', '999')
      formData.append('heightCm', '3')
      formData.append('widthCm', '2')
      
      const blob = new Blob(['fake image data'], { type: 'image/png' })
      formData.append('image', blob, 'test.png')

      const request = new NextRequest('http://localhost/api/admin/products', {
        method: 'POST',
        headers: {
          'x-admin-token': 'test-admin-token',
        },
        body: formData,
      })

      const response = await POST(request)
      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.code).toBe('INVALID_INPUT')
    })
  })

  describe('PATCH /api/admin/products/[id]', () => {
    it('should update a runtime product', async () => {
      const { updateRuntimeProduct } = await import('@/lib/runtime-products')
      
      // Mock successful update
      vi.mocked(updateRuntimeProduct).mockResolvedValue({
        id: 'test-product',
        name: 'Test Product',
        brand: 'Test Brand',
        type: 'single',
        heightCm: 3,
        widthCm: 2,
        metal: 'silver',
        priceInr: 1299, // Updated price
        imagePath: '/products/test-product.png',
        source: 'Runtime addition',
        licence: 'Runtime addition',
      })

      const request = new NextRequest('http://localhost/api/admin/products/test-product', {
        method: 'PATCH',
        headers: {
          'x-admin-token': 'test-admin-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ priceInr: 1299 }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'test-product' }) })
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.updatedFields).toContain('priceInr')
    })

    it('should return 403 when trying to update seed product', async () => {
      const { updateRuntimeProduct } = await import('@/lib/runtime-products')
      
      // Mock seed product error
      const error = new Error('Cannot update seed product')
      ;(error as any).code = 'INVALID_INPUT'
      ;(error as any).statusCode = 403
      vi.mocked(updateRuntimeProduct).mockRejectedValue(error)

      const request = new NextRequest('http://localhost/api/admin/products/gilded-teardrop', {
        method: 'PATCH',
        headers: {
          'x-admin-token': 'test-admin-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ priceInr: 2000 }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: 'gilded-teardrop' }) })
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.code).toBe('INVALID_INPUT')
    })
  })

  describe('DELETE /api/admin/products/[id]', () => {
    it('should delete a runtime product', async () => {
      const { deleteRuntimeProduct } = await import('@/lib/runtime-products')
      
      // Mock successful deletion
      vi.mocked(deleteRuntimeProduct).mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost/api/admin/products/test-product', {
        method: 'DELETE',
        headers: {
          'x-admin-token': 'test-admin-token',
        },
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'test-product' }) })
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.message).toContain('deleted successfully')
    })

    it('should return 403 when trying to delete seed product', async () => {
      const { deleteRuntimeProduct } = await import('@/lib/runtime-products')
      
      // Mock seed product error
      const error = new Error('Cannot delete seed product')
      ;(error as any).code = 'INVALID_INPUT'
      ;(error as any).statusCode = 403
      vi.mocked(deleteRuntimeProduct).mockRejectedValue(error)

      const request = new NextRequest('http://localhost/api/admin/products/gilded-teardrop', {
        method: 'DELETE',
        headers: {
          'x-admin-token': 'test-admin-token',
        },
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'gilded-teardrop' }) })
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.code).toBe('INVALID_INPUT')
    })
  })
})