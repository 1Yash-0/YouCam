import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { defaultStorage } from '@/lib/storage'
import { forgetFile, cleanupExpiredFiles } from '@/lib/youcam'
import { cleanupExpiredPrivateData } from '@/lib/private-cleanup'

export const runtime = 'nodejs'
export const maxDuration = 60

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const supplied = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1] ?? ''
  if (!secret || !supplied) return false
  const expectedBytes = Buffer.from(secret)
  const suppliedBytes = Buffer.from(supplied)
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  try {
    await cleanupExpiredPrivateData({ storage: defaultStorage, forgetFile })
    await cleanupExpiredFiles()
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
