import { NextRequest, NextResponse } from 'next/server'
import { env } from './env'
import { AppError, ErrorCodes } from './errors'

export function verifyAdminToken(request: NextRequest): void {
  const adminToken = env.ADMIN_TOKEN
  
  // If ADMIN_TOKEN is not set, all admin routes should return 503
  if (!adminToken) {
    throw new AppError(
      ErrorCodes.ADMIN_DISABLED,
      'Admin functionality is disabled',
      503
    )
  }
  
  // Get the x-admin-token header
  const providedToken = request.headers.get('x-admin-token')
  
  // If header is missing or doesn't match, return 401
  if (!providedToken || providedToken !== adminToken) {
    throw new AppError(
      ErrorCodes.UNAUTHORIZED,
      'Invalid admin token',
      401
    )
  }
}

export async function withAdminAuth(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    verifyAdminToken(request)
    return await handler(request)
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        code: error.code,
        message: error.message,
      }, { status: error.httpStatus })
    }
    
    console.error('Admin auth error:', error)
    return NextResponse.json({
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'Internal server error',
    }, { status: 500 })
  }
}