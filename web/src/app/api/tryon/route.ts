import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { AppError, ErrorCodes } from '@/lib/errors'
import { pipelineService } from '@/lib/tryon-pipeline'

export const runtime = 'nodejs'

// Schema for try-on requests (matches TryOnPipelineRequest)
const tryOnSchema = z.object({
  photoId: z.string().min(1),
  productId: z.string().min(1),
  sizeCm: z.number().positive().optional(),
  ear: z.enum(['right', 'left']).optional(),
  occluded: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  wearingLocation: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
  irisPx: z.number().positive().optional(),
  flow: z.enum(['ear', 'neck']).optional(),
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
    const body = await request.json()
    const validated = tryOnSchema.parse(body)
    
    // Get or create visitor ID
    let visitorId = request.cookies.get('darpan_vid')?.value
    if (!visitorId) {
      visitorId = crypto.randomUUID()
    }
    
    const result = await pipelineService.createPipelineTryOnJob(validated, visitorId)
    
    const response = NextResponse.json(result)
    
    // Set visitor cookie if not already set
    if (!request.cookies.get('darpan_vid')) {
      response.cookies.set({
        name: 'darpan_vid',
        value: visitorId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }
    
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
    
    console.error('Try-on creation error:', error)
    return NextResponse.json({
      code: ErrorCodes.INTERNAL_ERROR,
      userMessage: 'Failed to create try-on job.',
    }, { status: 500 })
  }
}