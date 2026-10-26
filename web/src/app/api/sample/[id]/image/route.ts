import { NextRequest, NextResponse } from 'next/server'
import { getJson, getFile } from '@/lib/storage'
import path from 'path'
import { findStaticSample, isSafeSampleImageName } from '@/lib/static-samples'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Keep local editable storage first when it has the requested sample.
    let manifest: unknown = null
    try {
      manifest = await getJson<unknown[]>('sample/manifest.json')
    } catch {
      // Static samples are the deployment-safe fallback.
    }

    const storedSample = Array.isArray(manifest)
      ? manifest.find((entry) => entry && typeof entry === 'object' && 'id' in entry && entry.id === id) as { imagePath?: unknown } | undefined
      : undefined

    if (storedSample?.imagePath !== undefined) {
      if (!isSafeSampleImageName(storedSample.imagePath)) {
        return NextResponse.json({
          code: 'INVALID_IMAGE_PATH',
          message: 'Invalid sample image path',
        }, { status: 400 })
      }

      let imageBuffer: Buffer | Uint8Array | null = null
      try {
        imageBuffer = await getFile(`sample/${storedSample.imagePath}`)
      } catch {
        // If the storage backend is unavailable, serve the reviewed static copy.
      }

      if (imageBuffer) {
        const ext = path.extname(storedSample.imagePath).toLowerCase()
        const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
        return new NextResponse(imageBuffer as any, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      }
    }

    const staticSample = findStaticSample(id)
    if (staticSample && isSafeSampleImageName(staticSample.imagePath)) {
      return NextResponse.redirect(new URL(`/samples/${staticSample.imagePath}`, request.url), 307)
    }

    return NextResponse.json({
      code: 'NOT_FOUND',
      message: 'Sample not found',
    }, { status: 404 })
    
  } catch (error) {
    console.error('Get sample image error:', error)
    return NextResponse.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to serve sample image',
    }, { status: 500 })
  }
}
