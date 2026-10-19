import { NextRequest, NextResponse } from 'next/server'
import { getJson } from '@/lib/storage'
import path from 'path'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Load sample manifest
    const manifestPath = path.join(process.cwd(), '..', '.data', 'sample', 'manifest.json')
    const manifest = await getJson<any[]>(manifestPath)
    
    if (!manifest || !Array.isArray(manifest)) {
      return NextResponse.json([])
    }
    
    // Transform manifest entries to include imageUrl
    const samples = manifest.map(entry => ({
      ...entry,
      imageUrl: `/api/sample/${entry.id}/image`,
    }))
    
    return NextResponse.json(samples)
    
  } catch (error) {
    console.error('Get sample error:', error)
    return NextResponse.json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch samples',
    }, { status: 500 })
  }
}