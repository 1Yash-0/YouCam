import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const state = vi.hoisted(() => ({ json: new Map<string, unknown>(), files: new Map<string, Buffer>(), createJob: vi.fn() }))
vi.mock('@/lib/storage', () => ({ defaultStorage: {
  getJson: async (key: string) => state.json.get(key) ?? null,
  putJson: async (key: string, value: unknown) => { state.json.set(key, value) },
  getFile: async (key: string) => state.files.get(key) ?? null,
  photoMetaPath: (key: string) => `meta/photos/${key}.json`, photoPath: (key: string) => `photos/${key}.png`,
  resultMetaPath: (key: string) => `meta/results/${key}.json`, resultPath: (key: string) => `results/${key}.png`,
  withLock: async (_key: string, action: () => Promise<unknown>) => action(),
} }))
vi.mock('@/lib/youcam', () => ({ forgetFile: vi.fn() }))
vi.mock('@/lib/tryon-pipeline', () => ({ pipelineService: { createPipelineTryOnJob: state.createJob }, hashParams: () => 'request-hash' }))
import { GET as resultImage } from '@/app/api/result/[key]/route'
import { GET as photoImage } from '@/app/api/photo/[photoId]/route'
import { POST as createPreview } from '@/app/api/tryon/route'
const owner = 'a'.repeat(64), other = 'd'.repeat(64), photo = 'b'.repeat(64), result = 'c'.repeat(64)
const future = () => new Date(Date.now() + 3600000).toISOString()
const request = (url: string, session?: string, body?: unknown) => new NextRequest(`http://localhost${url}`, { method: body ? 'POST' : 'GET', headers: { ...(session ? { cookie: `darpan_session=${session}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
beforeEach(() => {
  state.json.clear(); state.files.clear(); state.createJob.mockReset()
  for (const id of [owner, other]) state.json.set(`sessions/${id}.json`, { expiresAt: future() })
  state.json.set(`meta/photos/${photo}.json`, { ownerId: owner, expiresAt: future() })
  state.json.set(`meta/results/${result}.json`, { ownerId: owner, expiresAt: future() })
  state.files.set(`photos/${photo}.png`, Buffer.from('photo'))
  state.files.set(`results/${result}.png`, Buffer.from('result'))
})
describe('private API boundaries', () => {
  it('serves owner images without public caching', async () => {
    const response = await resultImage(request(`/api/result/${result}`, owner), { params: Promise.resolve({ key: result }) })
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.text()).toBe('result')
  })
  it('denies missing and unrelated sessions even with a valid result identifier', async () => {
    for (const [session, status] of [[undefined, 401], [other, 404]] as const) {
      const response = await resultImage(request(`/api/result/${result}`, session), { params: Promise.resolve({ key: result }) })
      expect(response.status).toBe(status)
    }
  })
  it('fails closed for legacy ownerless images and expired uploads', async () => {
    state.json.set(`meta/results/${result}.json`, {})
    state.json.set(`meta/photos/${photo}.json`, { ownerId: owner, expiresAt: '2000-01-01T00:00:00Z' })
    expect((await resultImage(request(`/api/result/${result}`, owner), { params: Promise.resolve({ key: result }) })).status).toBe(404)
    expect((await photoImage(request(`/api/photo/${photo}`, owner), { params: Promise.resolve({ photoId: photo }) })).status).toBe(404)
  })
  it('checks photo ownership before any provider pipeline can run', async () => {
    const response = await createPreview(request('/api/tryon', other, { photoId: photo, productId: 'gilded-teardrop' }))
    expect(response.status).toBe(404); expect(state.createJob).not.toHaveBeenCalled()
  })
  it('returns the same job for a repeated compatible request', async () => {
    state.createJob.mockResolvedValue({ status: 'running', jobId: 'existing-job' })
    const body = { photoId: photo, productId: 'gilded-teardrop', flow: 'ear', sizeCm: 3 }
    const first = await createPreview(request('/api/tryon', owner, body))
    const second = await createPreview(request('/api/tryon', owner, body))
    expect(await first.json()).toEqual(await second.json())
    expect(state.createJob).toHaveBeenCalledTimes(1)
  })
})
