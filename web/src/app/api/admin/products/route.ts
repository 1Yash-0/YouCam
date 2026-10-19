import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/admin'
import { createRuntimeProduct } from '@/lib/runtime-products'
import { z } from 'zod'

export const runtime = 'nodejs'

// Schema for multipart form data
const CreateProductSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  brand: z.string().min(1, 'Brand is required'),
  type: z.enum(['single', 'stud', 'necklace', 'garment']),
  priceInr: z.coerce.number().positive('Price must be positive'),
  
  // Type-specific fields
  heightCm: z.coerce.number().positive().optional(),
  widthCm: z.coerce.number().positive().optional(),
  lengthCm: z.coerce.number().positive().optional(),
  garmentCategory: z.enum(['upper_body', 'lower_body', 'full_body', 'outer']).optional(),
  
  // Optional fields
  metal: z.string().optional(),
  sizes: z.string().optional(), // Will be parsed as JSON array
  anchorPoint: z.string().optional(), // Will be parsed as JSON tuple [number, number]
})

async function handler(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse multipart form data
    const formData = await request.formData()
    
    // Extract fields
    const fields: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      if (key !== 'image' && typeof value === 'string') {
        fields[key] = value
      }
    }
    
    // Validate fields
    const validatedFields = CreateProductSchema.parse(fields)
    
    // Get image file
    const imageFile = formData.get('image') as File | null
    if (!imageFile) {
      return NextResponse.json({
        code: 'INVALID_INPUT',
        message: 'Image file is required',
      }, { status: 400 })
    }
    
    // Validate image type
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json({
        code: 'INVALID_INPUT',
        message: 'File must be an image',
      }, { status: 400 })
    }
    
    // Convert image to buffer
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
    
    // Parse sizes and anchorPoint if present
    const sizes = validatedFields.sizes ? JSON.parse(validatedFields.sizes) : undefined
    const anchorPoint = validatedFields.anchorPoint ? JSON.parse(validatedFields.anchorPoint) : undefined
    
    // Build product data based on type
    const productData = {
      id: validatedFields.id,
      name: validatedFields.name,
      brand: validatedFields.brand,
      type: validatedFields.type,
      priceInr: validatedFields.priceInr,
    } as any
    
    // Add type-specific fields
    switch (validatedFields.type) {
      case 'single':
      case 'stud':
        if (!validatedFields.heightCm || !validatedFields.widthCm) {
          return NextResponse.json({
            code: 'INVALID_INPUT',
            message: 'heightCm and widthCm are required for single/stud type',
          }, { status: 400 })
        }
        productData.heightCm = validatedFields.heightCm
        productData.widthCm = validatedFields.widthCm
        productData.metal = validatedFields.metal || 'silver'
        if (sizes) productData.sizes = sizes
        if (anchorPoint) productData.anchorPoint = anchorPoint
        break
        
      case 'necklace':
        if (!validatedFields.lengthCm) {
          return NextResponse.json({
            code: 'INVALID_INPUT',
            message: 'lengthCm is required for necklace type',
          }, { status: 400 })
        }
        productData.lengthCm = validatedFields.lengthCm
        break
        
      case 'garment':
        if (!validatedFields.garmentCategory) {
          return NextResponse.json({
            code: 'INVALID_INPUT',
            message: 'garmentCategory is required for garment type',
          }, { status: 400 })
        }
        productData.garmentCategory = validatedFields.garmentCategory
        break
    }
    
    // Create runtime product
    const product = await createRuntimeProduct(productData, imageBuffer)
    
    return NextResponse.json({
      id: product.id,
      name: product.name,
      type: product.type,
      message: 'Product created successfully',
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
    
    if (error instanceof Error && 'code' in error) {
      const appError = error as { code: string; message: string }
      return NextResponse.json({
        code: appError.code,
        message: appError.message,
      }, { status: (error as any).statusCode || 400 })
    }
    
    console.error('Create product error:', error)
    return NextResponse.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create product',
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withAdminAuth(request, handler)
}