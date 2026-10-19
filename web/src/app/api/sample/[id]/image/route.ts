import { NextRequest, NextResponse } from 'next/server'
import { getJson, getFile } from '@/lib/storage'
import path from 'path'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Load sample manifest to find the image path
    const manifestPath = path.join(process.cwd(), '..', '.data', 'sample', 'manifest.json')
    const manifest = await getJson<any[]>(manifestPath)
    
    if (!manifest || !Array.isArray(manifest)) {
      return NextResponse.json({
        code: 'NOT_FOUND',
        message: 'Sample not found',
      }, { status: 404 })
    }
    
    // Find the sample entry
    const sample = manifest.find(entry => entry.id === id)
    if (!sample || !sample.imagePath) {
      return NextResponse.json({
        code: 'NOT_FOUND',
        message: 'Sample not found',
      }, { status: 404 })
    }
    
    // Load image from sample directory
    const imagePath = path.join(process.cwd(), '..', '.data', 'sample', sample.imagePath)
    const imageBuffer = await getFile(imagePath)
    
    if (!imageBuffer) {
      return NextResponse.json({
        code: 'NOT_FOUND',
        message: 'Sample image not found',
      }, { status: 404 })
    }
    
    // Determine content type from file extension
    const ext = path.extname(sample.imagePath).toLowerCase()
    const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    
    return new NextResponse(imageBuffer as any, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
    
  } catch (error) {
    console.error('Get sample image error:', error)
    return NextResponse.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to serve sample image',
    }, { status: 500 })
  }
}