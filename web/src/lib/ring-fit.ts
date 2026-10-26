import sharp from 'sharp'

/**
 * True-size ring fitting for YouCam 2d-vto/ring.
 *
 * The API scales the whole ring so its band wraps the finger (probe-ring-fit: ring outer width ~1.12x finger width,
 * constant as the stone grows). A real stone keeps its size whatever the ring size, so the product photo is prepared
 * per ring size: the stone (with its setting) is enlarged in the photo until stone/finger in the render matches
 * stoneMm / ring inner diameter. The hoop is never touched.
 *
 * Calibration (carnelian ring, Met 243567, demo hand at assumed US 7): rendered stone px = C x photo stone/hoop ratio
 * x finger px, C = 1.025 (60 px stone, 0.547 ratio, 107 px finger); stone scale 1.2 / 1.4 measured x1.19 / x1.44.
 */
export const RING_FIT_C = 1.025
/** Largest stone enlargement checked on a real render (1.55 on the carnelian ring looked natural). */
export const MAX_STONE_SCALE = 1.6
export const DEFAULT_RING_SIZE_US = 7
const FEATHER = 8

/** Inner diameter in mm for a US ring size (standard: 11.63 + 0.8128 x size). */
export function ringInnerMm(sizeUs: number) {
  if (!(sizeUs >= 3 && sizeUs <= 13)) throw new Error('Ring size must be US 3 to 13')
  return 11.63 + 0.8128 * sizeUs
}

export interface RingSource {
  /** Stone (with setting) as an ellipse in photo px; this region is what gets enlarged */
  stone: { cx: number; cy: number; rx: number; ry: number }
  /** Stone length across the finger, and hoop outer width, in photo px */
  stoneLengthPx: number
  hoopOuterPx: number
}

export interface RingFitPlan {
  /** Stone enlargement applied to the photo (1 = photo as is) */
  scale: number
  /** Stone length the render will show, mm */
  shownMm: number
  /** True when the real stone is smaller than the photo shows on this finger, or larger than the cap allows */
  clamped: boolean
}

/** Stone length (mm) shown on a finger of this ring size at stone scale s. */
export function shownStoneMm(src: RingSource, s: number, sizeUs: number) {
  return RING_FIT_C * (src.stoneLengthPx / src.hoopOuterPx) * s * ringInnerMm(sizeUs)
}

export function planRingFit(src: RingSource, stoneMm: number, sizeUs = DEFAULT_RING_SIZE_US): RingFitPlan {
  if (!(stoneMm > 0)) throw new Error('stoneMm must be positive')
  const ideal = stoneMm / shownStoneMm(src, 1, sizeUs)
  // The photo can only enlarge the stone: shrinking would leave the old stone edge visible
  const scale = Math.min(MAX_STONE_SCALE, Math.max(1, Math.round(ideal * 100) / 100))
  return { scale, shownMm: shownStoneMm(src, scale, sizeUs), clamped: Math.abs(scale - ideal) > 0.02 }
}

/** Prepared product PNG: stone region resampled at plan.scale about its centre, soft edge, everything else untouched. */
export async function renderRingFit(bytes: Buffer, src: RingSource, plan: RingFitPlan): Promise<Buffer> {
  const { data: orig, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  if (plan.scale === 1) return sharp(orig, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer()
  const out = Buffer.from(orig)
  const s = plan.scale, { cx, cy } = src.stone, RX = src.stone.rx * s, RY = src.stone.ry * s
  for (let y = Math.max(0, Math.floor(cy - RY - FEATHER)); y < Math.min(H, Math.ceil(cy + RY + FEATHER)); y++) {
    for (let x = Math.max(0, Math.floor(cx - RX - FEATHER)); x < Math.min(W, Math.ceil(cx + RX + FEATHER)); x++) {
      const dx = x - cx, dy = y - cy
      const e = Math.hypot(dx / RX, dy / RY)
      const t = Math.min(1, Math.max(0, (1 - e) * Math.min(RX, RY) / FEATHER + 0.5))
      if (t <= 0) continue
      const sx = Math.round(cx + dx / s), sy = Math.round(cy + dy / s)
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue
      const i = (y * W + x) * 3, j = (sy * W + sx) * 3
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(orig[j + c] * t + orig[i + c] * (1 - t))
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer()
}
