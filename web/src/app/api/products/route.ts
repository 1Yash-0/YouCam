import { NextRequest, NextResponse } from 'next/server'
import { getAllProductsWithRuntime } from '@/lib/runtime-products'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const products = await getAllProductsWithRuntime()
    
    // Return without internal fileIds, handling discriminated union
    const publicProducts = products.map(product => {
      const base = {
        id: product.id,
        name: product.name,
        brand: product.brand,
        type: product.type,
        priceInr: product.priceInr,
        imagePath: product.imagePath,
        source: product.source,
        licence: product.licence,
      }
      
      switch (product.type) {
        case 'single':
        case 'stud':
          return {
            ...base,
            heightCm: product.heightCm,
            widthCm: product.widthCm,
            metal: product.metal,
            sizes: 'sizes' in product ? product.sizes : undefined,
            anchorPoint: 'anchorPoint' in product ? product.anchorPoint : undefined,
          }
        case 'necklace':
          return {
            ...base,
            lengthCm: product.lengthCm,
          }
        case 'garment':
          return {
            ...base,
            garmentCategory: product.garmentCategory,
          }
      }
    })
    
    return NextResponse.json(publicProducts)
  } catch (error) {
    console.error('Products list error:', error)
    return NextResponse.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch products',
    }, { status: 500 })
  }
}