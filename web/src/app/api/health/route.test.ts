import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCurrentBalance } = vi.hoisted(() => ({ getCurrentBalance: vi.fn() }))

vi.mock('@/lib/env', () => ({
  env: { ADMIN_TOKEN: 'test-admin-token', UNIT_RESERVE_FLOOR: 450 },
}))
vi.mock('@/lib/guard', () => ({ getCurrentBalance }))

import { GET } from './route'

describe('GET /api/health', () => {
  beforeEach(() => {
    getCurrentBalance.mockReset()
  })

  it('returns only public process status without querying upstream balance', async () => {
    const response = await GET(new NextRequest('http://localhost/api/health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, status: 'ok' })
    expect(getCurrentBalance).not.toHaveBeenCalled()
  })

  it('requires a valid admin token before returning upstream account details', async () => {
    const request = new NextRequest('http://localhost/api/health', {
      headers: { 'x-admin-token': 'wrong-token' },
    })

    const response = await GET(request)

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(getCurrentBalance).not.toHaveBeenCalled()
  })

  it('returns balance and reserve data to an authenticated admin', async () => {
    getCurrentBalance.mockResolvedValue(1234)
    const request = new NextRequest('http://localhost/api/health', {
      headers: { 'x-admin-token': 'test-admin-token' },
    })

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      authenticated: true,
      ok: true,
      units: 1234,
      reserveFloor: 450,
      keyValid: true,
    })
    expect(getCurrentBalance).toHaveBeenCalledOnce()
  })
})
