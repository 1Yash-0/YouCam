import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/looks/route'
import { GET } from '@/app/api/looks/[lookId]/route'
import { NextRequest } from 'next/server'

// Mock storage
vi.mock('@/lib/storage', () => ({
  getJson: vi.fn(),
  putJson: vi.fn(),
  looksPath: (id: string) => `looks/${id}.json`,
}))

// Mock runtime products
vi.mock('@/lib/runtime-products', () => ({
  getAllProductsWithRuntime: vi.fn(),
}))

describe('Looks API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/looks', () => {
    it('should create a look with valid data', async () => {
      const { putJson } = await import('@/lib/storage')
      const { getAllProductsWithRuntime } = await import('@/lib/runtime-products')
      
      vi.mocked(putJson).mockResolvedValue(undefined)
      vi.mocked(getAllProductsWithRuntime).mockResolvedValue([
        {
          id: 'gilded-teardrop',
          name: 'Gilded Teardrop',
          brand: 'Test Brand',
          type: 'single',
          heightCm: 3.0,
          widthCm: 1.3,
          metal: 'gold',
          priceInr: 1000,
          imagePath: '/products/gilded-teardrop.png',
          source: 'test',
          licence: 'test',
          sizes: [2.0, 3.0, 4.5, 6.0],
        },
      ])

      const request = new NextRequest('http://localhost/api/looks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          flow: 'single-earring',
          productId: 'gilded-teardrop',
          sizeCm: 3.0,
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.lookId).toMatch(/^[a-f0-9]{16}$/)
    })

    it('should create a look with stack and options', async () => {
      const { putJson } = await import('@/lib/storage')
      const { getAllProductsWithRuntime } = await import('@/lib/runtime-products')
      
      vi.mocked(putJson).mockResolvedValue(undefined)
      vi.mocked(getAllProductsWithRuntime).mockResolvedValue([
        {
          id: 'gilded-teardrop',
          name: 'Gilded Teardrop',
          brand: 'Test Brand',
          type: 'single',
          heightCm: 3.0,
          widthCm: 1.3,
          metal: 'gold',
          priceInr: 1000,
          imagePath: '/products/gilded-teardrop.png',
          source: 'test',
          licence: 'test',
          sizes: [2.0, 3.0, 4.5, 6.0],
        },
        {
          id: 'dot-stud',
          name: 'Dot Stud',
          brand: 'Test Brand',
          type: 'stud',
          heightCm: 0.6,
          widthCm: 0.6,
          metal: 'silver',
          priceInr: 500,
          imagePath: '/products/dot-stud.png',
          source: 'test',
          licence: 'test',
          sizes: [0.4, 0.6, 0.8],
        },
      ])

      const request = new NextRequest('http://localhost/api/looks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          flow: 'stack',
          productId: 'dot-stud',
          sizeCm: 0.6,
          stack: ['gilded-teardrop'],
          options: { background: 'studio' },
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.lookId).toBeDefined()
    })

    it('should return 400 when product not found', async () => {
      const { getAllProductsWithRuntime } = await import('@/lib/runtime-products')
      vi.mocked(getAllProductsWithRuntime).mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/looks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          flow: 'single-earring',
          productId: 'non-existent-product',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.code).toBe('INVALID_INPUT')
      expect(data.message).toBe('Product not found')
    })

    it('should return 400 when invalid size for product', async () => {
      const { getAllProductsWithRuntime } = await import('@/lib/runtime-products')
      vi.mocked(getAllProductsWithRuntime).mockResolvedValue([
        {
          id: 'gilded-teardrop',
          name: 'Gilded Teardrop',
          brand: 'Test Brand',
          type: 'single',
          heightCm: 3.0,
          widthCm: 1.3,
          metal: 'gold',
          priceInr: 1000,
          imagePath: '/products/gilded-teardrop.png',
          source: 'test',
          licence: 'test',
          sizes: [2.0, 3.0, 4.5, 6.0],
        },
      ])

      const request = new NextRequest('http://localhost/api/looks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          flow: 'single-earring',
          productId: 'gilded-teardrop',
          sizeCm: 999, // Invalid size
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.code).toBe('INVALID_INPUT')
      expect(data.message).toContain('Invalid size')
    })

    it('should return 400 when validation fails', async () => {
      const request = new NextRequest('http://localhost/api/looks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required fields
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.code).toBe('INVALID_INPUT')
      expect(data.errors).toBeDefined()
    })
  })

  describe('GET /api/looks/[lookId]', () => {
    it('should return look data', async () => {
      const { getJson } = await import('@/lib/storage')
      
      const mockLook = {
        id: 'testlook12345678',
        createdAt: '2024-01-01T00:00:00Z',
        flow: 'single-earring',
        productId: 'gilded-teardrop',
        sizeCm: 3.0,
      }
      
      vi.mocked(getJson).mockResolvedValue(mockLook)

      const request = new NextRequest('http://localhost/api/looks/testlook12345678')
      const response = await GET(request, { params: Promise.resolve({ lookId: 'testlook12345678' }) })
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.id).toBe('testlook12345678')
      expect(data.flow).toBe('single-earring')
      expect(data.productId).toBe('gilded-teardrop')
    })

    it('should return 404 when look not found', async () => {
      const { getJson } = await import('@/lib/storage')
      vi.mocked(getJson).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/looks/nonexistent')
      const response = await GET(request, { params: Promise.resolve({ lookId: 'nonexistent' }) })
      
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.code).toBe('NOT_FOUND')
    })
  })
})