import { NextRequest, NextResponse } from 'next/server'
import { defaultStorage } from '@/lib/storage'
import { getSession, assertOwned, routeError } from '@/lib/private-session'
import { AppError, ErrorCodes } from '@/lib/errors'
import type { OwnedResource } from '@/lib/private-session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    if (!/^[a-f0-9]{64}$/.test(key)) throw new AppError(ErrorCodes.NOT_FOUND, 'This private preview is unavailable or has expired.', 404)
    const ownerId = await getSession(request)
    const meta = await defaultStorage.getJson<OwnedResource>(defaultStorage.resultMetaPath(key))
    assertOwned(meta, ownerId)
    const imageBuffer = await defaultStorage.getFile(defaultStorage.resultPath(key))
    if (!imageBuffer) throw new AppError(ErrorCodes.NOT_FOUND, 'This private preview is unavailable or has expired.', 404)
    return new NextResponse(new Uint8Array(imageBuffer), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    const response = routeError(error)
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }
}
