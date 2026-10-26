import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStorage, SupabaseStorageBackend } from '@/lib/storage'

describe('Supabase storage backend', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('stores bytes in the private object bucket and JSON state through PostgREST', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init })
      if (String(input).includes('/rest/v1/darpan_state?select=')) return Response.json([{ value: { count: 2 } }])
      if (String(input).includes('/storage/v1/object/')) return new Response(new Uint8Array([1, 2, 3]))
      return new Response(null, { status: 200 })
    }) as typeof fetch
    const storage = new SupabaseStorageBackend({ url: 'https://demo.supabase.co/', serviceRoleKey: 'server-only', fetcher })

    await storage.putFile('photos/a.png', Buffer.from([1, 2, 3]))
    expect(await storage.getFile('photos/a.png')).toEqual(Buffer.from([1, 2, 3]))
    await storage.putJson('meta/jobs/a.json', { count: 2 })
    expect(await storage.getJson('meta/jobs/a.json')).toEqual({ count: 2 })

    expect(requests[0].url).toBe('https://demo.supabase.co/storage/v1/object/darpan-private/photos/a.png')
    expect(requests[0].init?.headers).toMatchObject({ apikey: 'server-only', Authorization: 'Bearer server-only', 'x-upsert': 'true' })
    expect(requests[0].init?.body).toBeInstanceOf(Uint8Array)
    expect(requests[2].url).toContain('/rest/v1/darpan_state?on_conflict=key')
    const stateWrite = JSON.parse(String(requests[2].init?.body))
    expect(stateWrite).toMatchObject({ key: 'meta/jobs/a.json', value: { count: 2 } })
    expect(stateWrite.updated_at).toEqual(expect.any(String))
  })

  it('handles missing objects and returns list keys with their prefix', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('/object/list/')) return Response.json([{ name: 'one.png' }, { name: 'two.png' }])
      return new Response(null, { status: 404 })
    }) as typeof fetch
    const storage = new SupabaseStorageBackend({ url: 'https://demo.supabase.co', serviceRoleKey: 'key', fetcher })
    expect(await storage.getFile('photos/missing.png')).toBeNull()
    expect(await storage.list('photos')).toEqual(['photos/one.png', 'photos/two.png'])
  })

  it('treats Supabase 400 not-found answers for missing objects as missing (seen in production)', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/rest/v1/darpan_state')) return Response.json([])
      if (init?.method === 'HEAD') return new Response(null, { status: 400 })
      return new Response(JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' }), { status: 400 })
    }) as typeof fetch
    const storage = new SupabaseStorageBackend({ url: 'https://demo.supabase.co', serviceRoleKey: 'key', fetcher })
    expect(await storage.exists('results/missing.png')).toBe(false)
    expect(await storage.getFile('results/missing.png')).toBeNull()
  })

  it('still fails loudly on other 400 errors when reading an object', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_jwt' }), { status: 400 })) as typeof fetch
    const storage = new SupabaseStorageBackend({ url: 'https://demo.supabase.co', serviceRoleKey: 'key', fetcher })
    await expect(storage.getFile('results/x.png')).rejects.toThrow(/400/)
  })

  it('lists nested object files and paginates state records without treating folders as files', async () => {
    const urls: string[] = []
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input); urls.push(url)
      if (url.includes('/rest/v1/darpan_state')) {
        const offset = Number(new URL(url).searchParams.get('offset'))
        return Response.json(Array.from({ length: offset === 0 ? 1000 : 1 }, (_, index) => ({ key: `owner_/${offset + index}` })))
      }
      if (url.includes('/object/list/')) {
        const body = JSON.parse(String(init?.body))
        return body.prefix === 'owner_/'
          ? Response.json([{ name: 'nested', id: null, metadata: null }])
          : Response.json([{ name: 'photo.png', id: 'object-id', metadata: {} }])
      }
      return new Response(null, { status: 404 })
    }) as typeof fetch
    const storage = new SupabaseStorageBackend({ url: 'https://demo.supabase.co', serviceRoleKey: 'key', fetcher })
    const listed = await storage.list('owner_/')
    expect(listed).toHaveLength(1002)
    expect(listed).toContain('owner_/nested/photo.png')
    expect(urls.some(url => url.includes('offset=1000'))).toBe(true)
    expect(urls.some(url => url.includes('%5C_'))).toBe(true)
  })

  it('uses SQL RPCs for one-time claims and bounded leases', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined })
      return Response.json(true)
    }) as typeof fetch
    const storage = new SupabaseStorageBackend({ url: 'https://demo.supabase.co', serviceRoleKey: 'key', fetcher })

    expect(await storage.claimOnce('job-1-step-1')).toBe(true)
    await expect(storage.withLock('job-1', async () => 'done')).resolves.toBe('done')
    expect(calls[0].url).toContain('/rpc/darpan_claim_once')
    expect(calls[1].url).toContain('/rpc/darpan_acquire_lease')
    expect(calls[1].body).toMatchObject({ lease_key: 'job-1', ttl_seconds: 120 })
    expect(calls[2].url).toContain('/rpc/darpan_release_lease')
  })

  it('binds backend methods when exposed through createStorage and sends quota RPC', async () => {
    const calls: Array<{ url: string; method?: string; body: unknown }> = []
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (init?.method === 'HEAD') return new Response(null, { status: 200 })
      return Response.json(true)
    }) as typeof fetch
    const backend = new SupabaseStorageBackend({ url: 'https://demo.supabase.co', serviceRoleKey: 'key', fetcher })
    const storage = createStorage({ rootDir: '/unused', backend })

    expect(await storage.exists('photos/present.png')).toBe(true)
    expect(await storage.reserveVisitorUnits?.('visitor-hash', '2026-10-25', 2, 20)).toBe(true)
    expect(calls[0].method).toBe('HEAD')
    expect(calls[1].url).toContain('/rpc/darpan_reserve_visitor_units')
    expect(calls[1].body).toEqual({ p_visitor_key: 'visitor-hash', p_usage_date: '2026-10-25', p_units: 2, p_cap: 20 })
  })

  it('creates short lived signed upload tickets and rejects unsafe keys', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init })
      return Response.json({ signedURL: '/object/upload/sign/darpan-staging/staging/photo.png', token: 'opaque' })
    }) as typeof fetch
    const storage = new SupabaseStorageBackend({ url: 'https://demo.supabase.co', serviceRoleKey: 'key', fetcher })
    expect(await storage.createUploadTicket('staging/photo.png', 90)).toEqual({ signedUrl: 'https://demo.supabase.co/storage/v1/object/upload/sign/darpan-staging/staging/photo.png', token: 'opaque' })
    expect(calls[0].url).toContain('/storage/v1/object/upload/sign/darpan-staging/staging/photo.png')
    expect(calls[0].init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(calls[0].init?.body).toBe(JSON.stringify({ expiresIn: 90 }))
    await expect(storage.createUploadTicket('../escape')).rejects.toThrow(/Invalid storage key/)
  })
})
