import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/youcam', () => ({
  youcam: {
    listHairTemplates: vi.fn(),
  },
}))

vi.mock('@/lib/storage', () => ({
  getJson: vi.fn(),
  putJson: vi.fn(),
}))

describe('Hair API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/hair/templates', () => {
    it('should return cached hair templates', async () => {
      const { getJson } = await import('@/lib/storage')
      const mockTemplates = [
        { id: 'female_messy_bun_brown', title: 'Messy Bun Brown', thumb: 'url1', keepsColour: true },
        { id: 'female_two_braids', title: 'Two Braids', thumb: 'url2', keepsColour: true },
      ]
      vi.mocked(getJson).mockResolvedValue({ fetchedAt: Date.now(), templates: mockTemplates })

      const { GET } = await import('@/app/api/hair/templates/route')
      const request = new NextRequest('http://localhost:3000/api/hair/templates')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockTemplates)
      expect(getJson).toHaveBeenCalledWith('hair-templates')
    })

    it('should fetch real templates when no cache exists', async () => {
      const { getJson, putJson } = await import('@/lib/storage')
      const { youcam } = await import('@/lib/youcam')
      vi.mocked(getJson).mockResolvedValue(null)
      vi.mocked(youcam.listHairTemplates).mockResolvedValue({ templates: [
        { template_id: 'female_two_braids', title: 'Two Braids', cover: 'https://cdn.test/braid.jpg' },
      ] })
      const mockPutJson = vi.mocked(putJson)

      const { GET } = await import('@/app/api/hair/templates/route')
      const request = new NextRequest('http://localhost:3000/api/hair/templates')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual([{ id: 'female_two_braids', title: 'Two Braids', thumb: 'https://cdn.test/braid.jpg', keepsColour: false }])
      expect(mockPutJson).toHaveBeenCalledWith('hair-templates', expect.objectContaining({ fetchedAt: expect.any(Number), templates: data }))
    })

    it('returns unavailable when the provider fails', async () => {
      const { getJson } = await import('@/lib/storage')
      const { youcam } = await import('@/lib/youcam')
      vi.mocked(getJson).mockResolvedValue(null)
      vi.mocked(youcam.listHairTemplates).mockRejectedValue(new Error('provider offline'))

      const { GET } = await import('@/app/api/hair/templates/route')
      const request = new NextRequest('http://localhost:3000/api/hair/templates')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data).toEqual({ error: 'Hair templates are temporarily unavailable' })
    })
  })
})
