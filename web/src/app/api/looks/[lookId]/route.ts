import { NextRequest, NextResponse } from 'next/server'
import { getJson, looksPath } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lookId: string }> }
) {
  try {
    const { lookId } = await params
    
    // Get look from storage
    const look = await getJson<any>(looksPath(lookId))
    
    if (!look) {
      return NextResponse.json({
        code: 'NOT_FOUND',
        message: 'Look not found',
      }, { status: 404 })
    }
    
    // Return look without sensitive data if any
    const { id, createdAt, flow, productId, sizeCm, stack, options } = look
    
    return NextResponse.json({
      id,
      createdAt,
      flow,
      productId,
      sizeCm,
      stack,
      options,
    })
    
  } catch (error) {
    console.error('Get look error:', error)
    return NextResponse.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch look',
    }, { status: 500 })
  }
}