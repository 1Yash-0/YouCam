'use client'

/**
 * Automatic iris measurement in the browser (MediaPipe Face Landmarker, iris landmarks 468-477).
 * The photo never leaves the device for this step: only the library and the model are downloaded.
 * Returns the iris diameter and centre in the image's own pixels, or null when no clear eye is found
 * (the shopper then sets the scale by hand, as before).
 */
const VERSION = '1.1.1'
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export interface IrisDetection { irisPx: number; center: { x: number; y: number }; eye: 'left' | 'right' }

type Pt = { x: number; y: number }
// MediaPipe iris rings: centre then four points (right/top/left/bottom). 468-472 one eye, 473-477 the other.
const RINGS = [{ eye: 'right' as const, centre: 468, ring: [469, 470, 471, 472] }, { eye: 'left' as const, centre: 473, ring: [474, 475, 476, 477] }]

/** Pure: iris measurement from normalised landmarks. Exported for tests. */
export function irisFromLandmarks(landmarks: Pt[], width: number, height: number): IrisDetection | null {
  if (!landmarks || landmarks.length < 478) return null
  const px = (p: Pt) => ({ x: p.x * width, y: p.y * height })
  const eyes = RINGS.map(({ eye, centre, ring }) => {
    const c = px(landmarks[centre])
    const [r, t, l, b] = ring.map((i) => px(landmarks[i]))
    // horizontal diameter is the more reliable one (eyelids cover the vertical edges)
    const horizontal = Math.hypot(r.x - l.x, r.y - l.y)
    const vertical = Math.hypot(t.x - b.x, t.y - b.y)
    return { eye, center: c, irisPx: horizontal, ratio: vertical > 0 ? horizontal / vertical : 0 }
  })
  // In a profile photo the far eye is foreshortened: use the larger, rounder iris.
  const good = eyes.filter((e) => e.irisPx >= 8 && e.ratio > 0.6 && e.ratio < 1.6)
  if (!good.length) return null
  const best = good.sort((a, b) => b.irisPx - a.irisPx)[0]
  return { irisPx: Math.round(best.irisPx * 10) / 10, center: { x: Math.round(best.center.x), y: Math.round(best.center.y) }, eye: best.eye }
}

/**
 * Pure: refine the iris width from pixels. Starting at the iris centre, scan left and right along a few rows
 * for the limbus: the strongest dark-to-bright step (iris to white of the eye). Landmark models often
 * overestimate the iris on angled faces; the visible edge is the truth. Falls back to the estimate when
 * the edges are not clear. `lum` is a width*height luminance array.
 */
export function refineIrisWidth(lum: Uint8ClampedArray | number[], width: number, height: number, cx: number, cy: number, estimate: number): number {
  const widths: number[] = []
  const at = (x: number, y: number) => lum[y * width + x]
  for (let dy = -3; dy <= 3; dy++) {
    const y = Math.round(cy + dy)
    if (y < 1 || y >= height - 1) continue
    const edge = (dir: 1 | -1) => {
      let best = 0, bestAt = -1
      for (let d = Math.round(estimate * 0.3); d <= Math.round(estimate * 0.75); d++) {
        const x = Math.round(cx + dir * d)
        if (x < 1 || x >= width - 1) break
        const step = at(x + dir, y) - at(x - dir, y) // brighter further out = limbus
        if (step > best) { best = step; bestAt = d }
      }
      return best >= 18 ? bestAt : -1
    }
    const l = edge(-1), r = edge(1)
    if (l > 0 && r > 0) widths.push(l + r)
  }
  if (widths.length < 3) return estimate
  widths.sort((a, b) => a - b)
  const median = widths[widths.length >> 1]
  return median >= estimate * 0.7 && median <= estimate * 1.15 ? median : estimate
}

let landmarker: Promise<import('@mediapipe/tasks-vision').FaceLandmarker> | null = null
async function getLandmarker() {
  if (!landmarker) {
    landmarker = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const files = await FilesetResolver.forVisionTasks(WASM)
      return FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 1 })
    })()
    landmarker.catch(() => { landmarker = null })
  }
  return landmarker
}

/** Detect the iris in a same-origin image URL. Times out rather than blocking the flow. */
export async function detectIris(imageUrl: string, timeoutMs = 12000): Promise<IrisDetection | null> {
  const run = async () => {
    const img = new Image()
    img.decoding = 'async'
    img.src = imageUrl
    await img.decode()
    const lm = await getLandmarker()
    const result = lm.detect(img)
    const W = img.naturalWidth, H = img.naturalHeight
    const coarse = irisFromLandmarks(result.faceLandmarks?.[0] ?? [], W, H)
    if (!coarse) return null
    // pixel refinement around the eye only
    const half = Math.ceil(coarse.irisPx * 1.2)
    const x0 = Math.max(0, coarse.center.x - half), y0 = Math.max(0, coarse.center.y - half)
    const w = Math.min(W - x0, half * 2), h = Math.min(H - y0, half * 2)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return coarse
    ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h)
    const rgba = ctx.getImageData(0, 0, w, h).data
    const lum = new Uint8ClampedArray(w * h)
    for (let i = 0; i < w * h; i++) lum[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
    const refined = refineIrisWidth(lum, w, h, coarse.center.x - x0, coarse.center.y - y0, coarse.irisPx)
    return { ...coarse, irisPx: Math.round(refined * 10) / 10 }
  }
  try {
    return await Promise.race([run(), new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))])
  } catch {
    return null
  }
}
