import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { defaultStorage as storage } from '@/lib/storage'
import { AppError, ErrorCodes } from '@/lib/errors'
import { assertOwned, assertSameOrigin, getSession, routeError, type OwnedResource } from '@/lib/private-session'
import { estimateSkinTone } from '@/lib/skin-tone'
import { styleFromSkin, type StyleResult } from '@/lib/style'

export const runtime = 'nodejs'

const SKIN_NOT_FOUND = 'SKIN_NOT_FOUND'
const SKIN_NOT_FOUND_MESSAGE = 'We could not read your skin tone from this photo.'
const BodySchema = z.object({ photoId: z.string().regex(/^[a-f0-9]{64}$/) })

type StyleResponse = StyleResult & { source: 'estimate' }

function privateResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

/**
 * Metal and lipstick for the shopper's own photo. Skin tone is estimated locally from pixels.
 * YouCam skin-tone-analysis is deliberately not called: it rejected our try-on photos (2026-10-25).
 * Sample photos are not accepted here; the Style it panel is only offered for personal photos.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const parsed = BodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid photo identifier.', 400)
    const { photoId } = parsed.data

    const ownerId = await getSession(request)
    // Same rule as GET /api/photo/[photoId]: unknown, expired or foreign photos are 404.
    assertOwned(await storage.getJson<OwnedResource>(storage.photoMetaPath(photoId)), ownerId)

    const cacheKey = `style/${photoId}.json`
    const cached = await storage.getJson<StyleResponse>(cacheKey)
    if (cached) return privateResponse(NextResponse.json(cached))

    const bytes = await storage.getFile(storage.photoPath(photoId))
    if (!bytes) throw new AppError(ErrorCodes.NOT_FOUND, 'This private photo is unavailable or has expired.', 404)

    const estimate = await estimateSkinTone(bytes)
    if (!estimate) throw new AppError(SKIN_NOT_FOUND, SKIN_NOT_FOUND_MESSAGE, 422)

    const result: StyleResponse = { ...styleFromSkin(estimate.hex), source: 'estimate' }
    await storage.putJson(cacheKey, result)
    return privateResponse(NextResponse.json(result))
  } catch (error) {
    return privateResponse(routeError(error))
  }
}
