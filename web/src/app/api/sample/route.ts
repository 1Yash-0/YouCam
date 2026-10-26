import { NextResponse } from 'next/server'
import { getJson } from '@/lib/storage'
import { STATIC_SAMPLE_MANIFEST } from '@/lib/static-samples'

export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
  try {
    // Prefer the editable storage manifest, but keep shipped reviewed examples
    // available when the deployment has no persistent sample storage.
    let manifest: unknown = null
    try {
      manifest = await getJson<unknown[]>('sample/manifest.json')
    } catch {
      // Storage may be unavailable in an ephemeral deployment; static samples remain usable.
    }
    const entries: Array<Record<string, unknown>> = Array.isArray(manifest) && manifest.length > 0
      ? manifest as Array<Record<string, unknown>>
      : STATIC_SAMPLE_MANIFEST
    
    // Transform manifest entries to include imageUrl
    const samples = entries.map((entry) => ({
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
