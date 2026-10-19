import { NextRequest, NextResponse } from 'next/server'
import { getProductWithRuntime } from '@/lib/runtime-products'
import { getFile, runtimeProductImagePath } from '@/lib/storage'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const product = await getProductWithRuntime(id)
    if (!product) {
      return NextResponse.json({
        code: 'NOT_FOUND',
        message: 'Product not found',
      }, { status: 404 })
    }
    
    let imageBuffer: Buffer | null = null
    let contentType = 'image/png'
    
    // Check if it's a seed product
    const seedProduct = product.source !== 'Runtime addition'
    if (seedProduct) {
      // Serve from public directory
      const imagePath = path.join(process.cwd(), 'public', product.imagePath)
      
      if (!fs.existsSync(imagePath)) {
        return NextResponse.json({
          code: 'NOT_FOUND',
          message: 'Product image not found',
        }, { status: 404 })
      }
      
      imageBuffer = await fs.promises.readFile(imagePath)
      const ext = path.extname(product.imagePath).toLowerCase()
      contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    } else {
      // Serve from runtime storage
      const imagePath = runtimeProductImagePath(id)
      imageBuffer = await getFile(imagePath)
      
      if (!imageBuffer) {
        return NextResponse.json({
          code: 'NOT_FOUND',
          message: 'Product image not found',
        }, { status: 404 })
      }
    }
    
    return new NextResponse(imageBuffer as any, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Product image error:', error)
    return NextResponse.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to serve product image',
    }, { status: 500 })
  }
}