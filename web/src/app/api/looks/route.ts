import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAllProductsWithRuntime } from '@/lib/runtime-products'
import { putJson, looksPath } from '@/lib/storage'
import crypto from 'crypto'

export const runtime = 'nodejs'

// Schema for creating a look
const CreateLookSchema = z.object({
  flow: z.string().min(1, 'Flow is required'),
  productId: z.string().min(1, 'Product ID is required'),
  sizeCm: z.number().positive().optional(),
  stack: z.array(z.string()).optional(),
  options: z.record(z.any()).optional(),
})

export type CreateLookRequest = z.infer<typeof CreateLookSchema>

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json()
    
    // Validate request
    const validated = CreateLookSchema.parse(body)
    
    // Validate product exists
    const products = await getAllProductsWithRuntime()
    const product = products.find(p => p.id === validated.productId)
    
    if (!product) {
      return NextResponse.json({
        code: 'INVALID_INPUT',
        message: 'Product not found',
      }, { status: 400 })
    }
    
    // Validate size if provided
    if (validated.sizeCm !== undefined) {
      if (product.type === 'single' || product.type === 'stud') {
        if (!('sizes' in product) || !product.sizes || !product.sizes.includes(validated.sizeCm)) {
          return NextResponse.json({
            code: 'INVALID_INPUT',
            message: `Invalid size for product. Available sizes: ${('sizes' in product && product.sizes) ? product.sizes.join(', ') : 'none'}`,
          }, { status: 400 })
        }
      }
    }
    
    // Generate look ID
    const lookId = crypto.randomBytes(8).toString('hex')
    
    // Create look object
    const look = {
      id: lookId,
      createdAt: new Date().toISOString(),
      ...validated,
    }
    
    // Save look
    await putJson(looksPath(lookId), look)
    
    return NextResponse.json({
      lookId,
    }, { status: 201 })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        code: 'INVALID_INPUT',
        message: 'Validation failed',
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      }, { status: 400 })
    }
    
    console.error('Create look error:', error)
    return NextResponse.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create look',
    }, { status: 500 })
  }
}