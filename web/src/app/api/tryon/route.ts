import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { AppError, ErrorCodes } from '@/lib/errors'
import { pipelineService, hashParams } from '@/lib/tryon-pipeline'
import { defaultStorage as storage } from '@/lib/storage'
import { getSession, assertOwned, assertSameOrigin, routeError } from '@/lib/private-session'

export const runtime = 'nodejs'
export const maxDuration = 90

// Schema for try-on requests (matches TryOnPipelineRequest)
const tryOnSchema = z.object({
  attemptId: z.string().uuid().optional(),
  photoId: z.string().min(1),
  productId: z.string().min(1),
  sizeCm: z.number().positive().optional(),
  ear: z.enum(['right', 'left']).optional(),
  occluded: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  wearingLocation: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
  irisPx: z.number().positive().optional(),
  flow: z.enum(['ear', 'neck', 'hand']).optional(),
  finger: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  ringSizeUs: z.number().min(3).max(13).multipleOf(0.5).optional(),
  stack: z.array(z.object({
    productId: z.string().min(1),
    sizeCm: z.number().positive(),
    wearingLocation: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])
  })).optional(),
  options: z.object({
    hairUp: z.object({
      templateId: z.string()
    }).optional(),
    lipstick: z.object({
      hex: z.string(),
      texture: z.string(),
      intensity: z.number().min(0).max(100)
    }).optional(),
    outfit: z.object({
      productId: z.string()
    }).optional()
  }).optional()
}).passthrough()



export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const body = await request.json()
    const validated = tryOnSchema.parse(body)
    if (!/^[a-f0-9]{64}$/.test(validated.photoId)) throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid photo identifier.', 400)
    
    // Get or create visitor ID
    const visitorId = await getSession(request)
    
    const action = async () => {
      assertOwned(await storage.getJson<any>(storage.photoMetaPath(validated.photoId)), visitorId)
      const requestKey = `private/photos/${validated.photoId}/requests/${hashParams(validated)}.json`
      const existing = await storage.getJson<any>(requestKey)
      if (existing) return existing
      const created = await pipelineService.createPipelineTryOnJob(validated, visitorId)
      await storage.putJson(requestKey, created)
      return created
    }
    const result = storage.withLock ? await storage.withLock(`private-photo:${validated.photoId}`, action) : await action()
    
    const response = NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
    
    return response
    
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        code: error.code,
        userMessage: error.userMessage || error.message,
      }, { status: error.httpStatus })
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        code: ErrorCodes.INVALID_INPUT,
        userMessage: error.errors[0]?.message || 'Invalid input',
      }, { status: 400 })
    }
    
    return routeError(error)
  }
}
