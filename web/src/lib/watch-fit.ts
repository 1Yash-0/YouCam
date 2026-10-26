import sharp from 'sharp'

/**
 * True-size watch fitting for YouCam 2d-vto/watch.
 *
 * Probes r6-r8 (outputs/probes/size) showed the API sizes the watch from the strap anchor span only:
 *   renderedCaseHeight / wristWidth ~= K * caseSpanPx / strapSpanPx
 * Case anchors are used for placement, not size. Measured K: 0.908 (r6 x1.0), 0.914 (r8 x0.9), 0.904 (r8 x1.1).
 * So we never move anchors off the real strap; we change the product image instead:
 * stretch the plain strap pieces (watch renders smaller) or crop strap off the ends (renders bigger).
 */
export const WATCH_FIT_K = 0.909
/** Average adult dorsal wrist width. Wrist photos carry no ruler, so sizes are true relative to this wrist. */
export const AVERAGE_WRIST_MM = 60
/** Minimum visible strap between anchor and case. r6 baseline had 130 px (clean); r8 x1.1 had 81 px (faint bezel smear). 100 is between, not yet probed. */
export const MIN_STRAP_PX = 100

export interface WatchSource {
  width: number; height: number
  /** x of the strap centre line */
  x: number
  strapBegin: number; caseTop: number; caseBottom: number; strapEnd: number
  /**
   * Visible lug-tip extent along the strap (what lugToLugMm measures). Defaults to caseTop..caseBottom.
   * Calibrated per photo from a real render when the lugs reach past the strap junction.
   */
  extentTop?: number; extentBottom?: number
}
export interface WatchFitPlan {
  topSrcHeight: number; topDstHeight: number; topCrop: number
  bottomSrcHeight: number; bottomDstHeight: number; bottomCrop: number
  height: number
  anchors: [[number, number], [number, number], [number, number], [number, number]]
  strapSpan: number
  /** Whole-photo upscale applied before cropping, so enough strap stays visible for large watches. 1 = none. */
  scale: number
}

/** Largest whole-photo upscale allowed to make room for strap. */
export const MAX_FIT_SCALE = 2

export function targetStrapSpan(src: WatchSource, lugToLugMm: number, wristMm = AVERAGE_WRIST_MM): number {
  if (!(lugToLugMm > 0) || !(wristMm > 0)) throw new Error('lugToLugMm and wristMm must be positive')
  const extent = (src.extentBottom ?? src.caseBottom) - (src.extentTop ?? src.caseTop)
  return WATCH_FIT_K * extent / (lugToLugMm / wristMm)
}

function scaleSource(src: WatchSource, s: number): WatchSource {
  const r = (v: number) => Math.round(v * s)
  return { width: r(src.width), height: r(src.height), x: r(src.x), strapBegin: r(src.strapBegin), caseTop: r(src.caseTop), caseBottom: r(src.caseBottom), strapEnd: r(src.strapEnd),
    extentTop: src.extentTop === undefined ? undefined : src.extentTop * s, extentBottom: src.extentBottom === undefined ? undefined : src.extentBottom * s }
}

export function planWatchFit(src0: WatchSource, lugToLugMm: number, wristMm = AVERAGE_WRIST_MM): WatchFitPlan {
  const { strapBegin: b0, caseTop: t0, caseBottom: c0, strapEnd: e0, height: H0 } = src0
  if (!(b0 < t0 && t0 < c0 && c0 < e0 && e0 <= H0)) throw new Error('WatchSource points must be ordered strapBegin < caseTop < caseBottom < strapEnd <= height')
  // Strap left after cropping must be >= MIN_STRAP_PX per side; spans scale with the photo, so upscale if needed.
  const runs0 = (t0 - b0) + (e0 - c0)
  const crop0 = (e0 - b0) - targetStrapSpan(src0, lugToLugMm, wristMm)
  let s = 1
  if (crop0 > 0 && runs0 - crop0 < 2 * MIN_STRAP_PX) {
    if (runs0 - crop0 <= 0) throw new Error(`Watch photo has too little strap to render ${lugToLugMm} mm lug-to-lug; use a photo with more strap visible`)
    s = Math.ceil((2 * MIN_STRAP_PX / (runs0 - crop0)) * 100) / 100
    if (s > MAX_FIT_SCALE) throw new Error(`Watch photo has too little strap to render ${lugToLugMm} mm lug-to-lug; use a photo with more strap visible`)
  }
  const src = s === 1 ? src0 : scaleSource(src0, s)
  const { x, height: H, strapBegin, caseTop, caseBottom, strapEnd } = src
  const span = targetStrapSpan(src, lugToLugMm, wristMm)
  const topRun = caseTop - strapBegin, bottomRun = strapEnd - caseBottom
  const topSrcHeight = caseTop, bottomSrcHeight = H - caseBottom
  const topMargin = strapBegin, bottomMargin = H - strapEnd
  let topDstHeight: number, bottomDstHeight: number, topCrop = 0, bottomCrop = 0, begin: number, end: number
  const delta = Math.round((span - (strapEnd - strapBegin)) / 2)
  if (delta >= 0) {
    // stretch strap pieces so each anchor-to-case distance grows by exactly delta
    topDstHeight = Math.round(topSrcHeight * (1 + delta / topRun)); bottomDstHeight = Math.round(bottomSrcHeight * (1 + delta / bottomRun))
    begin = topDstHeight - (topRun + delta)
    end = topDstHeight + (caseBottom - caseTop) + bottomRun + delta
  } else {
    // crop strap off the outer ends, more from the longer side, so both sides keep >= MIN_STRAP_PX
    const total = -2 * delta
    topCrop = Math.max(0, Math.min(total, Math.round((topRun - bottomRun + total) / 2)))
    bottomCrop = total - topCrop
    if (bottomRun - bottomCrop < MIN_STRAP_PX) { bottomCrop = Math.max(0, bottomRun - MIN_STRAP_PX); topCrop = total - bottomCrop }
    if (topRun - topCrop < MIN_STRAP_PX - 1 || bottomRun - bottomCrop < MIN_STRAP_PX - 1) throw new Error(`Watch photo has too little strap to render ${lugToLugMm} mm lug-to-lug; use a photo with more strap visible`)
    topDstHeight = topSrcHeight - topCrop; bottomDstHeight = bottomSrcHeight - bottomCrop
    begin = topMargin
    end = topDstHeight + (caseBottom - caseTop) + bottomDstHeight - bottomMargin
  }
  const height = topDstHeight + (caseBottom - caseTop) + bottomDstHeight
  const cTop = topDstHeight, cBottom = topDstHeight + (caseBottom - caseTop)
  return { topSrcHeight, topDstHeight, topCrop, bottomSrcHeight, bottomDstHeight, bottomCrop, height, strapSpan: end - begin, scale: s,
    anchors: [[x, begin], [x, end], [x, cTop], [x, cBottom]] }
}

/** Build the prepared product PNG for a plan. Case pixels are only resampled by the plan's whole-photo scale. */
export async function renderWatchFit(bytes0: Buffer, src0: WatchSource, plan: WatchFitPlan): Promise<Buffer> {
  const src = plan.scale === 1 ? src0 : scaleSource(src0, plan.scale)
  const bytes = plan.scale === 1 ? bytes0 : await sharp(bytes0).resize(src.width, src.height, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
  const W = src.width
  const piece = (top: number, h: number) => sharp(bytes).extract({ left: 0, top, width: W, height: h }).png().toBuffer()
  const top = plan.topCrop
    ? await piece(plan.topCrop, plan.topDstHeight)
    : await sharp(await piece(0, plan.topSrcHeight)).resize(W, plan.topDstHeight, { fit: 'fill' }).png().toBuffer()
  const mid = await piece(src.caseTop, src.caseBottom - src.caseTop)
  const bottom = plan.bottomCrop
    ? await piece(src.caseBottom, plan.bottomDstHeight)
    : await sharp(await piece(src.caseBottom, plan.bottomSrcHeight)).resize(W, plan.bottomDstHeight, { fit: 'fill' }).png().toBuffer()
  return sharp({ create: { width: W, height: plan.height, channels: 3, background: '#ffffff' } })
    .composite([{ input: top, top: 0, left: 0 }, { input: mid, top: plan.topDstHeight, left: 0 }, { input: bottom, top: plan.topDstHeight + src.caseBottom - src.caseTop, left: 0 }])
    .png().toBuffer()
}
