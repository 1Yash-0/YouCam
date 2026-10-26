import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/youcam', () => ({ youcam: { listHairTemplates: vi.fn() } }))
vi.mock('@/lib/storage', () => ({ getJson: vi.fn(), putJson: vi.fn() }))

describe('hair template catalog', () => {
  beforeEach(() => vi.resetAllMocks())

  it('normalizes actual API templates and filters to tied styles', async () => {
    const { normalizeHairTemplates } = await import('@/lib/hair-templates')
    expect(normalizeHairTemplates([
      { id: 'female_messy_bun_brown', title: 'Messy Bun Brown', thumb: 'https://cdn.test/bun.jpg', keep_users_color: false },
      { template_id: 'female_two_braids', title: 'Two Braids', cover: 'https://cdn.test/braid.jpg', supports_hair_color: true },
      { id: 'female_blunt_bob', title: 'Blunt Bob', thumb: 'https://cdn.test/bob.jpg' },
    ])).toEqual([
      { id: 'female_messy_bun_brown', title: 'Messy Bun Brown', thumb: 'https://cdn.test/bun.jpg', keepsColour: false },
      { id: 'female_two_braids', title: 'Two Braids', thumb: 'https://cdn.test/braid.jpg', keepsColour: true },
    ])
  })

  it('returns fresh real templates and caches them with a fetch timestamp', async () => {
    const { getJson, putJson } = await import('@/lib/storage')
    const { youcam } = await import('@/lib/youcam')
    vi.mocked(getJson).mockResolvedValue(null)
    vi.mocked(youcam.listHairTemplates).mockResolvedValue({ templates: [
      { template_id: 'female_two_braids', title: 'Two Braids', cover: 'https://cdn.test/braid.jpg' },
    ] })

    const { GET } = await import('@/app/api/hair/templates/route')
    const response = await GET(new NextRequest('http://localhost/api/hair/templates'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([
      { id: 'female_two_braids', title: 'Two Braids', thumb: 'https://cdn.test/braid.jpg', keepsColour: false },
    ])
    expect(youcam.listHairTemplates).toHaveBeenCalledWith({ limit: 20 })
    expect(putJson).toHaveBeenCalledWith('hair-templates', expect.objectContaining({
      fetchedAt: expect.any(Number),
      templates: [{ id: 'female_two_braids', title: 'Two Braids', thumb: 'https://cdn.test/braid.jpg', keepsColour: false }],
    }))
  })

  it('does not serve stale cache or invent examples when the provider fails', async () => {
    const { getJson } = await import('@/lib/storage')
    const { youcam } = await import('@/lib/youcam')
    vi.mocked(getJson).mockResolvedValue({ fetchedAt: Date.now() - 25 * 60 * 60 * 1000, templates: [
      { id: 'bun-01', title: 'Fake bun', thumb: 'https://example.com/bun.jpg', keepsColour: true },
    ] })
    vi.mocked(youcam.listHairTemplates).mockRejectedValue(new Error('provider offline'))

    const { GET } = await import('@/app/api/hair/templates/route')
    const response = await GET(new NextRequest('http://localhost/api/hair/templates'))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ error: 'Hair templates are temporarily unavailable' })
  })
})
