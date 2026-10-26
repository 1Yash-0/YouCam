import { describe, expect, it } from 'vitest'
import { heroFrameIndex, heroLayout, heroScrollDistance, heroSizeStage } from './hero-motion'

describe('shared hero choreography', () => {
  it('changes every category at the same checkpoints in either scroll direction', () => {
    expect([0, .299, .3, .649, .65, 1, .64, .29].map(heroSizeStage)).toEqual([0, 0, 1, 1, 2, 2, 1, 0])
    expect([0, 1, 2].map(stage => heroFrameIndex(4, stage as 0 | 1 | 2))).toEqual([0, 1, 3])
    expect([0, 1, 2].map(stage => heroFrameIndex(3, stage as 0 | 1 | 2))).toEqual([0, 1, 2])
  })
  it('bounds the scroll distance and fits complete frames to measured interface space', () => {
    expect([480, 720, 900, 1400].map(heroScrollDistance)).toEqual([400, 432, 540, 600])
    const dimensions = { availableWidth: 1168, viewportHeight: 720, headerHeight: 72, galleryChrome: 96, cardChrome: 72, columns: 4 as const, gap: 24, reduced: false }
    expect(heroLayout(dimensions)).toEqual({ width: 1168, pin: true })
    expect(heroLayout({ ...dimensions, reduced: true }).pin).toBe(false)
    expect(heroLayout({ ...dimensions, viewportHeight: 480 }).pin).toBe(false)
    expect(heroLayout({ ...dimensions, galleryChrome: 500 }).pin).toBe(false)
  })
})
