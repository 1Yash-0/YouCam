import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as GETSampleList } from '@/app/api/sample/route'
import { GET as GETSampleImage } from '@/app/api/sample/[id]/image/route'
import { NextRequest } from 'next/server'
import path from 'path'

// Mock storage
vi.mock('@/lib/storage', () => ({
  getJson: vi.fn(),
  getFile: vi.fn(),
}))

describe('Sample API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/sample', () => {
    it('should return empty array when manifest does not exist', async () => {
      const { getJson } = await import('@/lib/storage')
      vi.mocked(getJson).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/sample')
      const response = await GETSampleList(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual([])
    })

    it('should return manifest entries with image URLs', async () => {
      const { getJson } = await import('@/lib/storage')
      
      const mockManifest = [
        {
          id: 'sample-1',
          title: 'Test Sample 1',
          flow: 'single-earring',
          productId: 'gilded-teardrop',
          sizeCm: 3.0,
          steps: ['upload', 'detect', 'tryon'],
          imagePath: 'sample1.png',
        },
        {
          id: 'sample-2',
          title: 'Test Sample 2',
          flow: 'stack',
          productId: 'dot-stud',
          sizeCm: 0.6,
          steps: ['upload', 'detect', 'stack-tryon'],
          imagePath: 'sample2.png',
        },
      ]
      
      vi.mocked(getJson).mockImplementation((filePath: string) => {
        if (filePath.includes('manifest.json')) {
          return Promise.resolve(mockManifest)
        }
        return Promise.resolve(null)
      })

      const request = new NextRequest('http://localhost/api/sample')
      const response = await GETSampleList(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data).toHaveLength(2)
      expect(data[0].id).toBe('sample-1')
      expect(data[0].imageUrl).toBe('/api/sample/sample-1/image')
      expect(data[1].id).toBe('sample-2')
      expect(data[1].imageUrl).toBe('/api/sample/sample-2/image')
    })
  })

  describe('GET /api/sample/[id]/image', () => {
    it('should return 404 when manifest does not exist', async () => {
      const { getJson } = await import('@/lib/storage')
      vi.mocked(getJson).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/sample/sample-1/image')
      const response = await GETSampleImage(request, { params: Promise.resolve({ id: 'sample-1' }) })
      
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.code).toBe('NOT_FOUND')
    })

    it('should return 404 when sample not found in manifest', async () => {
      const { getJson } = await import('@/lib/storage')
      
      const mockManifest = [
        {
          id: 'sample-1',
          title: 'Test Sample 1',
          imagePath: 'sample1.png',
        },
      ]
      
      vi.mocked(getJson).mockImplementation((filePath: string) => {
        if (filePath.includes('manifest.json')) {
          return Promise.resolve(mockManifest)
        }
        return Promise.resolve(null)
      })

      const request = new NextRequest('http://localhost/api/sample/nonexistent/image')
      const response = await GETSampleImage(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.code).toBe('NOT_FOUND')
    })

    it('should return 404 when image file not found', async () => {
      const { getJson, getFile } = await import('@/lib/storage')
      
      const mockManifest = [
        {
          id: 'sample-1',
          title: 'Test Sample 1',
          imagePath: 'sample1.png',
        },
      ]
      
      vi.mocked(getJson).mockImplementation((filePath: string) => {
        if (filePath.includes('manifest.json')) {
          return Promise.resolve(mockManifest)
        }
        return Promise.resolve(null)
      })
      
      vi.mocked(getFile).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/sample/sample-1/image')
      const response = await GETSampleImage(request, { params: Promise.resolve({ id: 'sample-1' }) })
      
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.code).toBe('NOT_FOUND')
    })

    it('should return image when found', async () => {
      const { getJson, getFile } = await import('@/lib/storage')
      
      const mockManifest = [
        {
          id: 'sample-1',
          title: 'Test Sample 1',
          imagePath: 'sample1.png',
        },
      ]
      
      const mockImageBuffer = Buffer.from('fake image data')
      
      vi.mocked(getJson).mockImplementation((filePath: string) => {
        if (filePath.includes('manifest.json')) {
          return Promise.resolve(mockManifest)
        }
        return Promise.resolve(null)
      })
      
      vi.mocked(getFile).mockResolvedValue(mockImageBuffer)

      const request = new NextRequest('http://localhost/api/sample/sample-1/image')
      const response = await GETSampleImage(request, { params: Promise.resolve({ id: 'sample-1' }) })
      
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('cache-control')).toContain('max-age=31536000')
      
      const imageBuffer = await response.arrayBuffer()
      expect(imageBuffer).toBeDefined()
    })

    it('should return JPEG content type for .jpg files', async () => {
      const { getJson, getFile } = await import('@/lib/storage')
      
      const mockManifest = [
        {
          id: 'sample-jpg',
          title: 'Test JPG Sample',
          imagePath: 'sample.jpg',
        },
      ]
      
      const mockImageBuffer = Buffer.from('fake image data')
      
      vi.mocked(getJson).mockImplementation((filePath: string) => {
        if (filePath.includes('manifest.json')) {
          return Promise.resolve(mockManifest)
        }
        return Promise.resolve(null)
      })
      
      vi.mocked(getFile).mockResolvedValue(mockImageBuffer)

      const request = new NextRequest('http://localhost/api/sample/sample-jpg/image')
      const response = await GETSampleImage(request, { params: Promise.resolve({ id: 'sample-jpg' }) })
      
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/jpeg')
    })
  })
})