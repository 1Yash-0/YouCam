import { NextRequest, NextResponse } from 'next/server'
import { AppError, ErrorCodes } from '@/lib/errors'
import { pipelineService } from '@/lib/tryon-pipeline'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  try {
    const result = await pipelineService.checkPipelineJobStatus(jobId)
    
    return NextResponse.json(result)
    
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        code: error.code,
        userMessage: error.userMessage || error.message,
      }, { status: error.httpStatus })
    }
    
    console.error('Job status check error:', error)
    return NextResponse.json({
      code: ErrorCodes.INTERNAL_ERROR,
      userMessage: 'Failed to check job status.',
    }, { status: 500 })
  }
}