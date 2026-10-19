import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/admin'
import { updateRuntimeProduct, deleteRuntimeProduct } from '@/lib/runtime-products'
import { z } from 'zod'

export const runtime = 'nodejs'

// Schema for PATCH updates
const UpdateProductSchema = z.object({
  anchorPoint: z.tuple([z.number(), z.number()]).optional(),
  sizes: z.array(z.number()).optional(),
  priceInr: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params
    
    // Parse request body
    const body = await request.json()
    
    // Validate updates
    const updates = UpdateProductSchema.parse(body)
    
    // Update runtime product
    const updatedProduct = await updateRuntimeProduct(id, updates)
    
    return NextResponse.json({
      id: updatedProduct.id,
      name: updatedProduct.name,
      type: updatedProduct.type,
      updatedFields: Object.keys(updates),
      message: 'Product updated successfully',
    })
    
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
    
    if (error instanceof Error && 'code' in error) {
      const appError = error as { code: string; message: string }
      return NextResponse.json({
        code: appError.code,
        message: appError.message,
      }, { status: (error as any).statusCode || 400 })
    }
    
    console.error('Update product error:', error)
    return NextResponse.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update product',
    }, { status: 500 })
  }
}

async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params
    
    // Delete runtime product
    await deleteRuntimeProduct(id)
    
    return NextResponse.json({
      id,
      message: 'Product deleted successfully',
    })
    
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const appError = error as { code: string; message: string }
      return NextResponse.json({
        code: appError.code,
        message: appError.message,
      }, { status: (error as any).statusCode || 400 })
    }
    
    console.error('Delete product error:', error)
    return NextResponse.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete product',
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withAdminAuth(request, (req) => PATCHHandler(req, { params }))
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withAdminAuth(request, (req) => DELETEHandler(req, { params }))
}