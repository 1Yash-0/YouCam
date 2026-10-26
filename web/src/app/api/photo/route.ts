import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { normalisePhoto } from '@/lib/images'
import { sha256 } from '@/lib/hash'
import { uploadFile } from '@/lib/youcam'
import { defaultStorage as storage } from '@/lib/storage'
import { AppError, ErrorCodes } from '@/lib/errors'
import { getSession, assertSameOrigin, assertOwned, PRIVATE_TTL_MS, withSessionCookie, routeError } from '@/lib/private-session'
export const runtime = 'nodejs'
export const maxDuration = 90
export async function POST(request: NextRequest) {
  let stagingKey: string | undefined
  let stagingMeta: string | undefined
  try {
    assertSameOrigin(request)
    const ownerId = await getSession(request, true)
    let buffer: Buffer
    if (request.headers.get('content-type')?.includes('application/json')) {
      const { uploadKey } = await request.json()
      if (typeof uploadKey !== 'string' || !new RegExp(`^staging/${ownerId}/[0-9]{13}-[a-f0-9-]{36}$`).test(uploadKey)) throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid private upload.', 400)
      stagingMeta = `staging-meta/${ownerId}/${uploadKey.split('/').pop()}.json`
      const ticket = await storage.getJson<any>(stagingMeta)
      assertOwned(ticket, ownerId)
      stagingKey = uploadKey
      const uploaded = await storage.getFile(uploadKey)
      if (!uploaded) throw new AppError(ErrorCodes.NOT_FOUND, 'Upload not found.', 404)
      buffer = uploaded
    } else {
      const form = await request.formData(); const file = form.get('photo')
      if (!(file instanceof File)) throw new AppError(ErrorCodes.INVALID_INPUT, 'Please upload a photo.', 400)
      if (file.size > 4 * 1024 * 1024) throw new AppError(ErrorCodes.INVALID_INPUT, 'Photo must be smaller than 4 MB after preparation.', 400)
      buffer = Buffer.from(await file.arrayBuffer())
    }
    if (buffer.length > 4 * 1024 * 1024) throw new AppError(ErrorCodes.INVALID_INPUT, 'Photo must be smaller than 4 MB after preparation.', 400)
    const normalised = await normalisePhoto(buffer)
    // Namespace identical photos by owner, preventing private cross-session cache sharing.
    if (normalised.width < 600 || normalised.height < 600) throw new AppError(ErrorCodes.BAD_IMAGE, 'Use a photo at least 600 × 600 pixels.', 400)
    const photoId = sha256(Buffer.concat([Buffer.from(`${ownerId}:${randomUUID()}`), normalised.png]))
    const expiresAt = new Date(Date.now() + PRIVATE_TTL_MS).toISOString()
    const fileId = await uploadFile(normalised.png, 'image/png', 'private-photo.png')
    await storage.putFile(storage.photoPath(photoId), normalised.png)
    await storage.putJson(storage.photoMetaPath(photoId), { fileId, ownerId, expiresAt, uploadedAt: new Date().toISOString(), width: normalised.width, height: normalised.height })
    return withSessionCookie(NextResponse.json({ photoId, width: normalised.width, height: normalised.height }), ownerId)
  } catch (error) { return routeError(error) }
  finally {
    if (stagingKey) await storage.delete?.(stagingKey)
    if (stagingMeta) await storage.delete?.(stagingMeta)
  }
}
