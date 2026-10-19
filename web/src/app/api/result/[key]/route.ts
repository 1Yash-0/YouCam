import { NextRequest, NextResponse } from 'next/server'
import { getFile } from '@/lib/storage'
import { AppError, ErrorCodes } from '@/lib/errors'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  try {
    const imageBuffer = await getFile(`results/${key}.png`)
    
    if (!imageBuffer) {
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        `Result not found: ${key}`,
        404
      )
    }
    
    return new NextResponse(imageBuffer as any, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
    
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        code: error.code,
        userMessage: error.userMessage || error.message,
      }, { status: error.httpStatus })
    }
    
    console.error('Result serve error:', error)
    return NextResponse.json({
      code: ErrorCodes.INTERNAL_ERROR,
      userMessage: 'Failed to serve result.',
    }, { status: 500 })
  }
}