import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/admin'
import { getCurrentBalance } from '@/lib/guard'
import { env } from '@/lib/env'
import { AppError, ErrorCodes } from '@/lib/errors'

export const runtime = 'nodejs'

async function adminHealth(): Promise<NextResponse> {
  try {
    const balance = await getCurrentBalance()
    
    return NextResponse.json({
      authenticated: true,
      ok: true,
      units: balance,
      reserveFloor: env.UNIT_RESERVE_FLOOR,
      keyValid: true,
    })
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCodes.INVALID_KEY) {
      return NextResponse.json({
        authenticated: true,
        ok: false,
        code: ErrorCodes.INVALID_KEY,
        keyValid: false,
      })
    }
    
    // For other errors, still return health check but with error
    console.error('Health check error:', error)
    return NextResponse.json({
      authenticated: true,
      ok: false,
      code: ErrorCodes.INTERNAL_ERROR,
      keyValid: false,
    })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!request.headers.has('x-admin-token')) {
    return NextResponse.json({ ok: true, status: 'ok' })
  }
  return withAdminAuth(request, adminHealth)
}
