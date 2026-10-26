import { NextRequest, NextResponse } from 'next/server'
import { defaultStorage } from '@/lib/storage'
import { forgetFile } from '@/lib/youcam'
import { assertOwned, assertSameOrigin, getSession, routeError } from '@/lib/private-session'
import { deleteOwnedPhoto } from '@/lib/private-cleanup'
import type { PhotoMeta } from '@/lib/tryon-pipeline'
import { AppError, ErrorCodes } from '@/lib/errors'

export const runtime = 'nodejs'

function privateResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    const { photoId } = await params
    if (!/^[a-f0-9]{64}$/.test(photoId)) throw new AppError(ErrorCodes.NOT_FOUND, 'This private photo is unavailable or has expired.', 404)
    const ownerId = await getSession(request)
    const meta = await defaultStorage.getJson<PhotoMeta>(defaultStorage.photoMetaPath(photoId))
    if (!meta || typeof meta.ownerId !== 'string' || typeof meta.expiresAt !== 'string') throw new AppError(ErrorCodes.NOT_FOUND, 'This private photo is unavailable or has expired.', 404)
    assertOwned({ ownerId: meta.ownerId, expiresAt: meta.expiresAt }, ownerId)
    const bytes = await defaultStorage.getFile(defaultStorage.photoPath(photoId))
    if (!bytes) throw new AppError(ErrorCodes.NOT_FOUND, 'This private photo is unavailable or has expired.', 404)
    return privateResponse(new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff' } }))
  } catch (error) {
    return privateResponse(routeError(error))
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    assertSameOrigin(request)
    const { photoId } = await params
    const ownerId = await getSession(request)
    await deleteOwnedPhoto({ storage: defaultStorage, forgetFile }, photoId, ownerId)
    return privateResponse(NextResponse.json({ deleted: true }))
  } catch (error) {
    return privateResponse(routeError(error))
  }
}
