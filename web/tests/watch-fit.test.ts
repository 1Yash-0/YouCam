import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { planWatchFit, renderWatchFit, targetStrapSpan, WATCH_FIT_K, type WatchSource } from '@/lib/watch-fit'

// watch2.png geometry used in probes r6-r8
const SRC: WatchSource = { width: 1104, height: 1472, x: 552, strapBegin: 40, caseTop: 170, caseBottom: 1320, strapEnd: 1440 }
const ratio = (p: ReturnType<typeof planWatchFit>) => WATCH_FIT_K * (p.anchors[3][1] - p.anchors[2][1]) / p.strapSpan

describe('watch-fit', () => {
  it('baseline lug size keeps the source span (r6 render)', () => {
    const lug = 60 * WATCH_FIT_K * 1150 / 1400
    const p = planWatchFit(SRC, lug)
    expect(p.height).toBe(1472)
    expect(p.anchors).toEqual([[552, 40], [552, 1440], [552, 170], [552, 1320]])
  })

  it('smaller watch stretches strap; predicted on-wrist ratio matches lug/wrist', () => {
    const p = planWatchFit(SRC, 40)
    expect(p.topCrop).toBe(0)
    expect(p.height).toBeGreaterThan(1472)
    expect(ratio(p)).toBeCloseTo(40 / 60, 2)
    // case pixels untouched
    expect(p.anchors[3][1] - p.anchors[2][1]).toBe(1150)
  })

  it('bigger watch crops strap and keeps anchors on strap', () => {
    const p = planWatchFit(SRC, 46)
    expect(p.topCrop).toBeGreaterThan(0)
    expect(ratio(p)).toBeCloseTo(46 / 60, 2)
    expect(p.anchors[0][1]).toBe(40)
  })

  it('very large watch upscales the photo so both sides keep >= MIN_STRAP_PX, still true to lug/wrist', () => {
    const p = planWatchFit(SRC, 50)
    expect(p.scale).toBeGreaterThan(1)
    expect(p.scale).toBeLessThanOrEqual(2)
    expect(p.anchors[2][1] - p.anchors[0][1]).toBeGreaterThanOrEqual(99)
    expect(p.anchors[1][1] - p.anchors[3][1]).toBeGreaterThanOrEqual(99)
    expect(WATCH_FIT_K * (p.anchors[3][1] - p.anchors[2][1]) / p.strapSpan).toBeCloseTo(50 / 60, 2)
  })

  it('refuses sizes that would need more than a 2x upscale', () => {
    expect(() => planWatchFit(SRC, 70)).toThrow(/too little strap/)
  })

  it('extent (lug tips) sets size when given, not the strap junction points', () => {
    const withExtent = { ...SRC, extentTop: SRC.caseTop - 50, extentBottom: SRC.caseBottom + 50 }
    const p = planWatchFit(withExtent, 40)
    expect(WATCH_FIT_K * 1250 / p.strapSpan).toBeCloseTo(40 / 60, 2)
  })

  it('size difference between products is proportional, not exaggerated', () => {
    const a = ratio(planWatchFit(SRC, 40)), b = ratio(planWatchFit(SRC, 44))
    expect(b / a).toBeCloseTo(1.1, 2)
  })

  it('validates input', () => {
    expect(() => targetStrapSpan(SRC, 0)).toThrow()
    expect(() => planWatchFit({ ...SRC, caseTop: 10 }, 40)).toThrow(/ordered/)
  })

  it('renders an image of the planned height with the case band unchanged', async () => {
    const src = { ...SRC, width: 20, height: 100, x: 10, strapBegin: 5, caseTop: 30, caseBottom: 70, strapEnd: 95 }
    const raw = Buffer.alloc(20 * 100 * 3)
    for (let y = 0; y < 100; y++) for (let x = 0; x < 20; x++) raw[(y * 20 + x) * 3] = y
    const png = await sharp(raw, { raw: { width: 20, height: 100, channels: 3 } }).png().toBuffer()
    const lug = 60 * WATCH_FIT_K * 40 / 120 // ~1.33x span -> stretch
    const plan = planWatchFit(src, lug)
    const out = await renderWatchFit(png, src, plan)
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
    expect(info.height).toBe(plan.height)
    expect(data[(plan.topDstHeight * 20) * info.channels]).toBe(30)
    expect(data[((plan.topDstHeight + 39) * 20) * info.channels]).toBe(69)
  })
})
