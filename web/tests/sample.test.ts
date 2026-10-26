import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as GETSampleList } from '@/app/api/sample/route'
import { GET as GETSampleImage } from '@/app/api/sample/[id]/image/route'
import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'
import staticManifest from '../data/sample-manifest.json'

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
    it('falls back to the shipped sample manifest when storage has no manifest', async () => {
      const { getJson } = await import('@/lib/storage')
      vi.mocked(getJson).mockResolvedValue(null)

      const response = await GETSampleList()
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveLength(staticManifest.length)
      expect(data.map((entry: { id: string }) => entry.id)).toEqual(staticManifest.map((entry) => entry.id))
      expect(data.every((entry: { imageUrl: string }) => entry.imageUrl.startsWith('/api/sample/'))).toBe(true)
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

      const response = await GETSampleList()
      
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

    it('redirects to the shipped image when storage has no manifest entry', async () => {
      const { getJson, getFile } = await import('@/lib/storage')
      vi.mocked(getJson).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/sample/single-teardrop-3cm/image')
      const response = await GETSampleImage(request, { params: Promise.resolve({ id: 'single-teardrop-3cm' }) })

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/samples/single-teardrop-3cm.png')
      expect(vi.mocked(getFile)).not.toHaveBeenCalled()
    })

    it('uses the shipped image when the legacy manifest does not list that sample', async () => {
      const { getJson, getFile } = await import('@/lib/storage')
      vi.mocked(getJson).mockResolvedValue([{ id: 'legacy-only', imagePath: 'legacy.png' }])

      const request = new NextRequest('http://localhost/api/sample/necklace/image')
      const response = await GETSampleImage(request, { params: Promise.resolve({ id: 'necklace' }) })

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/samples/necklace.png')
      expect(vi.mocked(getFile)).not.toHaveBeenCalled()
    })

    it('ships a real static image for every sample manifest entry', () => {
      for (const sample of staticManifest) {
        expect(fs.existsSync(path.join(process.cwd(), 'public', 'samples', sample.imagePath)), sample.id).toBe(true)
        expect(sample.imagePath).not.toMatch(/[\\/]|\.\./)
      }
    })

    it('should return image when found in a temporary DATA_DIR', async () => {
      const { getJson, getFile } = await import('@/lib/storage')
      const fs = await import('fs/promises')
      const os = await import('os')
      const tempDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'darpan-sample-'))
      const manifest = [
        {
          id: 'sample-1',
          title: 'Test Sample 1',
          imagePath: 'sample1.png',
        },
      ]
      const image = Buffer.from('fake image data')

      await fs.mkdir(path.join(tempDataDir, 'sample'), { recursive: true })
      await fs.writeFile(path.join(tempDataDir, 'sample', 'manifest.json'), JSON.stringify(manifest))
      await fs.writeFile(path.join(tempDataDir, 'sample', 'sample1.png'), image)
      vi.mocked(getJson).mockImplementation(async (key: string) => {
        expect(key).toBe('sample/manifest.json')
        return JSON.parse(await fs.readFile(path.join(tempDataDir, key), 'utf8'))
      })
      vi.mocked(getFile).mockImplementation(async (key: string) => {
        expect(key).toBe('sample/sample1.png')
        return fs.readFile(path.join(tempDataDir, key))
      })

      try {
        const request = new NextRequest('http://localhost/api/sample/sample-1/image')
        const response = await GETSampleImage(request, { params: Promise.resolve({ id: 'sample-1' }) })

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('image/png')
        expect(response.headers.get('cache-control')).toContain('max-age=31536000')
        expect(Buffer.from(await response.arrayBuffer())).toEqual(image)
      } finally {
        await fs.rm(tempDataDir, { recursive: true, force: true })
      }
    })

    it('should reject unsafe image paths', async () => {
      const { getJson, getFile } = await import('@/lib/storage')
      vi.mocked(getJson).mockResolvedValue([
        { id: 'unsafe', title: 'Unsafe', imagePath: '../outside.png' },
      ])
      vi.mocked(getFile).mockResolvedValue(Buffer.from('should not be read'))

      const request = new NextRequest('http://localhost/api/sample/unsafe/image')
      const response = await GETSampleImage(request, { params: Promise.resolve({ id: 'unsafe' }) })

      expect(response.status).toBe(400)
      expect(vi.mocked(getFile)).not.toHaveBeenCalled()
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
