import { describe, expect, it } from 'vitest'
import { irisFromLandmarks } from '@/lib/iris-detect'

// Builds a 478-point landmark list with one or two irises at given centres and radii (normalised).
function face(W: number, H: number, eyes: Array<{ id: 0 | 1; cx: number; cy: number; r: number; squash?: number }>) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
  for (const e of eyes) {
    const base = e.id === 0 ? 468 : 473
    const rv = e.r * (e.squash ?? 1)
    lm[base] = { x: e.cx / W, y: e.cy / H }
    lm[base + 1] = { x: (e.cx + e.r) / W, y: e.cy / H } // right
    lm[base + 2] = { x: e.cx / W, y: (e.cy - rv) / H } // top
    lm[base + 3] = { x: (e.cx - e.r) / W, y: e.cy / H } // left
    lm[base + 4] = { x: e.cx / W, y: (e.cy + rv) / H } // bottom
  }
  return lm
}

describe('irisFromLandmarks', () => {
  it('measures the horizontal iris diameter in image pixels', () => {
    const r = irisFromLandmarks(face(1104, 1472, [{ id: 0, cx: 617, cy: 480, r: 20.5 }]), 1104, 1472)
    expect(r?.irisPx).toBeCloseTo(41, 0)
    expect(r?.center).toEqual({ x: 617, y: 480 })
  })

  it('uses the larger, rounder iris when one eye is foreshortened (profile photo)', () => {
    const r = irisFromLandmarks(face(1104, 1472, [{ id: 0, cx: 617, cy: 480, r: 20 }, { id: 1, cx: 822, cy: 478, r: 9, squash: 2 }]), 1104, 1472)
    expect(r?.irisPx).toBeCloseTo(40, 0)
    expect(r?.eye).toBe('right')
  })

  it('returns null without landmarks or with an implausible iris', () => {
    expect(irisFromLandmarks([], 1104, 1472)).toBeNull()
    expect(irisFromLandmarks(face(1104, 1472, [{ id: 0, cx: 617, cy: 480, r: 2 }]), 1104, 1472)).toBeNull()
  })
})
