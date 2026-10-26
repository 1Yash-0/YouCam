import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { defaultStorage } from '@/lib/storage'
import { getSession, assertSameOrigin, withSessionCookie, routeError } from '@/lib/private-session'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const owner = await getSession(request, true)
    if (!defaultStorage.createUploadTicket) return withSessionCookie(NextResponse.json({ multipart: true }), owner)
    const key = `staging/${owner}/${Date.now()}-${randomUUID()}`
    const ticket = await defaultStorage.createUploadTicket(key)
    await defaultStorage.putJson(`staging-meta/${owner}/${key.split('/').pop()}.json`, { key, ownerId: owner, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
    return withSessionCookie(NextResponse.json({ key, signedUrl: ticket.signedUrl }), owner)
  } catch (error) { return routeError(error) }
}
