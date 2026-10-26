import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { defaultStorage } from './storage'
import { AppError, ErrorCodes } from './errors'

const COOKIE = 'darpan_session'
const SESSION_MS = 30 * 24 * 60 * 60 * 1000
export const PRIVATE_TTL_MS = 24 * 60 * 60 * 1000
export interface OwnedResource { ownerId: string; expiresAt: string }

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return

  const host = request.headers.get('host') || request.nextUrl.host
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
  const protocol = forwardedProto === 'http' || forwardedProto === 'https'
    ? `${forwardedProto}:`
    : request.nextUrl.protocol
  let matches = false
  try {
    matches = new URL(origin).origin === new URL(`${protocol}//${host}`).origin
  } catch {
    // Invalid or opaque Origin values are rejected below.
  }
  if (!matches) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Request origin does not match this application.', 403)
}
export async function getSession(request: NextRequest, create = false) {
  let id = request.cookies.get(COOKIE)?.value
  if (id && /^[a-f0-9]{64}$/.test(id)) {
    const record = await defaultStorage.getJson<{ expiresAt: string }>(`sessions/${id}.json`)
    if (record && Date.parse(record.expiresAt) > Date.now()) return id
  }
  if (!create) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Please start a new private photo session.', 401)
  id = randomBytes(32).toString('hex')
  await defaultStorage.putJson(`sessions/${id}.json`, { expiresAt: new Date(Date.now() + SESSION_MS).toISOString() })
  return id
}
export function withSessionCookie(response: NextResponse, id: string) {
  response.cookies.set(COOKIE, id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_MS / 1000 })
  return response
}
export function assertOwned(resource: OwnedResource | null, ownerId: string) {
  if (!resource || resource.ownerId !== ownerId || !Number.isFinite(Date.parse(resource.expiresAt)) || Date.parse(resource.expiresAt) <= Date.now()) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'This private photo or preview is unavailable or has expired.', 404)
  }
}
export function routeError(error: unknown) {
  if (error instanceof AppError) return NextResponse.json({ code: error.code, userMessage: error.userMessage || error.message }, { status: error.httpStatus })
  // Never send third-party request bodies or credentials to the client.
  return NextResponse.json({ code: ErrorCodes.INTERNAL_ERROR, userMessage: 'This request could not be completed. Please retry.' }, { status: 500 })
}
