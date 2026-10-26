import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchHealth } from './admin-api'

afterEach(() => vi.unstubAllGlobals())

describe('admin health client', () => {
  it('sends the admin token in the request header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, units: 1234, reserveFloor: 450, keyValid: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchHealth(' test-admin-token ')

    expect(fetchMock).toHaveBeenCalledWith('/api/health', {
      headers: { 'x-admin-token': 'test-admin-token' },
    })
  })
})
