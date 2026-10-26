import { NextRequest, NextResponse } from 'next/server'
import { AppError, ErrorCodes } from '@/lib/errors'
import { pipelineService } from '@/lib/tryon-pipeline'
import { defaultStorage as storage } from '@/lib/storage'
import { getSession, assertOwned, routeError } from '@/lib/private-session'

export const runtime = 'nodejs'
export const maxDuration = 90

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  try {
    if (!/^[a-f0-9-]{36}$/.test(jobId)) throw new AppError(ErrorCodes.NOT_FOUND, 'Preview not found.', 404)
    const owner = await getSession(request)
    const job = await storage.getJson<any>(storage.pipelineJobPath(jobId))
    assertOwned(job, owner)
    const action = async () => {
      assertOwned(await storage.getJson<any>(storage.photoMetaPath(job.originalPhotoId)), owner)
      return pipelineService.checkPipelineJobStatus(jobId)
    }
    const result = storage.withLock ? await storage.withLock(`private-photo:${job.originalPhotoId}`, action) : await action()
    
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
    
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        code: error.code,
        userMessage: error.userMessage || error.message,
      }, { status: error.httpStatus })
    }
    
    return routeError(error)
  }
}
