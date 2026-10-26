import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { MAX_STONE_SCALE, planRingFit, renderRingFit, ringInnerMm, shownStoneMm, type RingSource } from '@/lib/ring-fit'

// carnelian ring, Met 243567 (data/products.json)
const SRC: RingSource = { stone: { cx: 700, cy: 671, rx: 158, ry: 82 }, stoneLengthPx: 257, hoopOuterPx: 470 }

describe('ring-fit', () => {
  it('US ring size to inner diameter (standard table)', () => {
    expect(ringInnerMm(7)).toBeCloseTo(17.32, 1)
    expect(ringInnerMm(5)).toBeCloseTo(15.69, 1)
    expect(() => ringInnerMm(20)).toThrow()
  })

  it('reproduces the calibration render: photo as is on a US 7 finger shows ~9.7 mm', () => {
    expect(shownStoneMm(SRC, 1, 7)).toBeCloseTo(9.71, 1)
  })

  it('a real stone keeps its size across ring sizes: bigger finger needs less enlargement', () => {
    const small = planRingFit(SRC, 13, 5), big = planRingFit(SRC, 13, 9)
    expect(small.scale).toBeGreaterThan(big.scale)
    expect(small.shownMm).toBeCloseTo(13, 0)
    expect(big.shownMm).toBeCloseTo(13, 0)
    expect(small.clamped || big.clamped).toBe(false)
  })

  it('clamps and says so when the photo cannot show the stone that small or that large', () => {
    const tiny = planRingFit(SRC, 5, 7)
    expect(tiny.scale).toBe(1)
    expect(tiny.clamped).toBe(true)
    expect(tiny.shownMm).toBeGreaterThan(5)
    const huge = planRingFit(SRC, 30, 7)
    expect(huge.scale).toBe(MAX_STONE_SCALE)
    expect(huge.clamped).toBe(true)
  })

  it('renderRingFit changes only the stone region', async () => {
    const W = 1400, H = 1050
    const bytes = await sharp({ create: { width: W, height: H, channels: 3, background: '#808080' } })
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><ellipse cx="700" cy="671" rx="120" ry="60" fill="#c00"/></svg>`) }]).png().toBuffer()
    const out = await sharp(await renderRingFit(bytes, SRC, { scale: 1.3, shownMm: 0, clamped: false })).raw().toBuffer({ resolveWithObject: true })
    const px = (x: number, y: number) => out.data[(y * W + x) * out.info.channels]
    expect(px(700 + 145, 671)).toBeGreaterThan(150) // stone edge moved out: 120 * 1.3 = 156
    expect(px(100, 100)).toBe(128) // far away untouched
  })
})
