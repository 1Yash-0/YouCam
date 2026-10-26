import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  apiClient,
  ApiClientError,
  getHealth,
  getProducts,
  uploadPhoto,
  createTryOn,
  pollTryOn,
  getResultImage,
  getSamples,
} from '@/lib/api-client'

describe('apiClient', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('getResultImage returns encoded path', () => {
    expect(apiClient.getResultImage('abc123key')).toBe('/api/result/abc123key')
    expect(apiClient.getResultImage('key with spaces')).toBe('/api/result/key%20with%20spaces')
  })

  it('getHealth parses successful health response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, units: 100 }),
    })

    const health = await apiClient.getHealth()
    expect(health.ok).toBe(true)
    expect(health.units).toBe(100)
    expect(global.fetch).toHaveBeenCalledWith('/api/health', expect.any(Object))
  })

  it('getProducts fetches product catalogue', async () => {
    const mockProducts = [
      {
        id: 'gilded-teardrop',
        name: 'Gilded Teardrop',
        brand: 'Darpan',
        type: 'single',
        heightCm: 3.0,
        widthCm: 1.3,
        metal: 'gold',
        priceUsd: 1499,
        imagePath: '/products/teardrop-gold.png',
        source: 'AI',
        licence: 'Demo',
      },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProducts,
    })

    const products = await apiClient.getProducts()
    expect(products).toHaveLength(1)
    expect(products[0].id).toBe('gilded-teardrop')
  })

  it('uploadPhoto sends FormData with photo file', async () => {
    let capturedBody: FormData | null = null

    global.fetch = vi.fn().mockImplementation((url, init) => {
      capturedBody = init.body
      return Promise.resolve({
        ok: true,
        json: async () => ({ photoId: 'hash123', width: 800, height: 1000 }),
      })
    })

    const file = new File(['dummy-bytes'], 'photo.png', { type: 'image/png' })
    const result = await apiClient.uploadPhoto(file)

    const form = capturedBody as unknown as FormData | null
    expect(result.photoId).toBe('hash123')
    expect(form).toBeInstanceOf(FormData)
    expect(form?.get('photo')).toBeDefined()
  })

  it('createTryOn sends json request body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'running', jobId: 'job-999' }),
    })

    const res = await apiClient.createTryOn({
      photoId: 'p1',
      productId: 'gilded-teardrop',
      sizeCm: 3.0,
      ear: 'right',
    })

    expect(res.status).toBe('running')
    if (res.status === 'running') {
      expect(res.jobId).toBe('job-999')
    }
  })

  it('pollTryOn requests specific jobId', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'done',
        result: {
          key: 'res-key',
          imageUrl: '/api/result/res-key',
          flow: 'ear',
          steps: [],
          unitsSpent: 1,
        },
      }),
    })

    const res = await apiClient.pollTryOn('job-123')
    expect(res.status).toBe('done')
    if (res.status === 'done') {
      expect(res.result.key).toBe('res-key')
    }
  })

  it('throws ApiClientError with code and userMessage on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        code: 'INVALID_INPUT',
        userMessage: 'Please provide a valid earring size.',
        message: 'Validation error',
      }),
    })

    await expect(
      apiClient.createTryOn({ photoId: '', productId: '' })
    ).rejects.toThrow(ApiClientError)

    try {
      await apiClient.createTryOn({ photoId: '', productId: '' })
    } catch (err: any) {
      expect(err.code).toBe('INVALID_INPUT')
      expect(err.status).toBe(400)
      expect(err.userMessage).toBe('Please provide a valid earring size.')
    }
  })

  it('handles non-json error responses gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Not JSON')
      },
    })

    await expect(apiClient.getHealth()).rejects.toThrow('Request failed with status 502')
  })

  it('getSamples fetches sample looks', async () => {
    const mockSamples = [
      {
        id: 'sample-1',
        title: 'Teardrop 3cm',
        flow: 'ear',
        productId: 'gilded-teardrop',
        sizeCm: 3.0,
        steps: ['earring'],
        imageUrl: '/api/sample/sample-1/image',
      },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSamples,
    })

    const samples = await apiClient.getSamples()
    expect(samples).toHaveLength(1)
    expect(samples[0].id).toBe('sample-1')
  })

  it('named export wrappers point to the same functions', () => {
    expect(getHealth).toBe(apiClient.getHealth)
    expect(getProducts).toBe(apiClient.getProducts)
    expect(uploadPhoto).toBe(apiClient.uploadPhoto)
    expect(createTryOn).toBe(apiClient.createTryOn)
    expect(pollTryOn).toBe(apiClient.pollTryOn)
    expect(getResultImage).toBe(apiClient.getResultImage)
    expect(getSamples).toBe(apiClient.getSamples)
  })
})

