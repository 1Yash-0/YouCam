import sharp from 'sharp'

export interface RawImage {
  data: Buffer
  width: number
  height: number
}

export interface BoundingBox {
  x: number
  y: number
  w: number
  h: number
  pixels: number
  resized?: boolean
}

export interface Measurement {
  box: BoundingBox
  renderedPx: number
  renderedCm?: number
  errorPct?: number
  withinTolerance?: boolean
  tolerancePct: number
  note?: string
}

/**
 * Convert image buffer to RawImage
 */
async function toRawImage(buf: Buffer): Promise<RawImage> {
  const { data, info } = await sharp(buf)
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })
  
  if (info.channels !== 3) {
    throw new Error(`Expected 3 channels after removeAlpha, got ${info.channels}`)
  }
  
  return {
    data,
    width: info.width,
    height: info.height,
  }
}

/**
 * Find connected components using 8-connectivity flood fill
 */
function findConnectedComponents(
  diff: Uint8Array,
  width: number,
  height: number,
  threshold: number
): BoundingBox[] {
  const visited = new Uint8Array(width * height)
  const components: BoundingBox[] = []
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      
      if (diff[idx] > threshold && visited[idx] === 0) {
        // Start flood fill
        const stack: [number, number][] = [[x, y]]
        let minX = x, maxX = x
        let minY = y, maxY = y
        let pixelCount = 0
        
        visited[idx] = 1
        
        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!
          pixelCount++
          
          minX = Math.min(minX, cx)
          maxX = Math.max(maxX, cx)
          minY = Math.min(minY, cy)
          maxY = Math.max(maxY, cy)
          
          // 8-connected neighbours: thin hooks render as 1px diagonal lines,
          // which 4-connectivity splits off from the earring body
          const neighbors = [
            [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1],
            [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1],
          ]
          
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = ny * width + nx
              if (diff[nidx] > threshold && visited[nidx] === 0) {
                visited[nidx] = 1
                stack.push([nx, ny])
              }
            }
          }
        }
        
        if (pixelCount >= 30) { // Ignore components < 30 px
          components.push({
            x: minX,
            y: minY,
            w: maxX - minX + 1,
            h: maxY - minY + 1,
            pixels: pixelCount,
          })
        }
      }
    }
  }
  
  return components
}

/**
 * Find the largest changed region between two images
 */
export async function diffBox(
  before: RawImage | Buffer,
  after: RawImage | Buffer,
  threshold: number = 40
): Promise<BoundingBox | null> {
  // Convert buffers to RawImage if needed
  const beforeImg = Buffer.isBuffer(before) ? await toRawImage(before) : before
  const afterImg = Buffer.isBuffer(after) ? await toRawImage(after) : after
  
  // Resize after to before dimensions if they differ
  let processedAfter = afterImg
  let resized = false
  
  if (beforeImg.width !== afterImg.width || beforeImg.height !== afterImg.height) {
    const resizedBuffer = await sharp(afterImg.data, {
      raw: { width: afterImg.width, height: afterImg.height, channels: 3 }
    })
      .resize(beforeImg.width, beforeImg.height, { fit: 'fill', kernel: 'nearest' })
      .raw()
      .toBuffer()
    
    processedAfter = {
      data: resizedBuffer,
      width: beforeImg.width,
      height: beforeImg.height,
    }
    resized = true
  }
  
  const width = beforeImg.width
  const height = beforeImg.height
  const diff = new Uint8Array(width * height)
  
  // Compute per-pixel max channel difference
  for (let i = 0; i < beforeImg.data.length; i += 3) {
    const idx = i / 3
    
    const r1 = beforeImg.data[i]
    const g1 = beforeImg.data[i + 1]
    const b1 = beforeImg.data[i + 2]
    
    const r2 = processedAfter.data[i]
    const g2 = processedAfter.data[i + 1]
    const b2 = processedAfter.data[i + 2]
    
    const dr = Math.abs(r1 - r2)
    const dg = Math.abs(g1 - g2)
    const db = Math.abs(b1 - b2)
    
    diff[idx] = Math.max(dr, dg, db)
  }
  
  // Find connected components
  const components = findConnectedComponents(diff, width, height, threshold)
  
  if (components.length === 0) {
    return null
  }
  
  // Return the largest component
  const largest = components.reduce((a, b) => a.pixels > b.pixels ? a : b)
  if (resized) {
    largest.resized = true
  }
  
  return largest
}

/**
 * Calculate pixels per cm from iris measurement
 */
export function pxPerCm(irisPx: number, irisMm: number = 11.7): number {
  return irisPx / (irisMm / 10) // Convert mm to cm
}

/**
 * Measure the rendered earring size
 */
export async function measure({
  before,
  after,
  requestedCm,
  irisPx,
  irisMm = 11.7,
  tolerancePct = 10,
}: {
  before: Buffer
  after: Buffer
  requestedCm: number
  irisPx?: number
  irisMm?: number
  tolerancePct?: number
}): Promise<Measurement> {
  const box = await diffBox(before, after)
  
  if (!box) {
    throw new Error('No significant changes detected between images')
  }
  
  const result: Measurement = {
    box,
    renderedPx: box.h,
    tolerancePct,
  }
  
  if (irisPx !== undefined) {
    const pxPerCmValue = pxPerCm(irisPx, irisMm)
    result.renderedCm = box.h / pxPerCmValue
    result.errorPct = ((result.renderedCm - requestedCm) / requestedCm) * 100
    result.withinTolerance = Math.abs(result.errorPct) <= tolerancePct
  } else {
    result.note = 'iris not provided'
  }
  
  return result
}

/**
 * Calculate corrected scale for re-rendering
 */
export function correctedScale(
  requestedCm: number,
  renderedCm: number,
  clampFactor: number = 2.0
): number {
  // Avoid division by zero
  if (renderedCm === 0) {
    return requestedCm
  }
  
  const correction = requestedCm * requestedCm / renderedCm
  const min = requestedCm / clampFactor
  const max = requestedCm * clampFactor
  
  return Math.max(min, Math.min(max, correction))
}