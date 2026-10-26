import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { AppError } from './errors'
import { assertSameOrigin } from './private-session'

describe('assertSameOrigin', () => {
  it('accepts the matching request host when Next URL normalization differs', () => {
    const request = new NextRequest('http://127.0.0.1:3123/api/photo/upload', {
      headers: { host: '127.0.0.1:3123', origin: 'http://127.0.0.1:3123' },
    })

    expect(() => assertSameOrigin(request)).not.toThrow()
  })

  it('rejects an origin that does not match the request host', () => {
    const request = new NextRequest('http://127.0.0.1:3123/api/photo/upload', {
      headers: { host: '127.0.0.1:3123', origin: 'https://attacker.example' },
    })

    try {
      assertSameOrigin(request)
      throw new Error('Expected a same-origin rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).httpStatus).toBe(403)
    }
  })
})
