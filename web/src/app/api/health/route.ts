import { NextRequest, NextResponse } from 'next/server'
import { getCurrentBalance } from '@/lib/guard'
import { env } from '@/lib/env'
import { AppError, ErrorCodes } from '@/lib/errors'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const balance = await getCurrentBalance()
    
    return NextResponse.json({
      ok: true,
      units: balance,
      reserveFloor: env.UNIT_RESERVE_FLOOR,
      keyValid: true,
    })
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCodes.INVALID_KEY) {
      return NextResponse.json({
        ok: false,
        code: ErrorCodes.INVALID_KEY,
      }, { status: 500 })
    }
    
    // For other errors, still return health check but with error
    console.error('Health check error:', error)
    return NextResponse.json({
      ok: false,
      code: ErrorCodes.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}