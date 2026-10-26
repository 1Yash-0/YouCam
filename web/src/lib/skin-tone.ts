import sharp from 'sharp'

/**
 * Skin tone estimated from the shopper's own photo (no API call).
 * YouCam skin-tone-analysis rejects most try-on photos (profile ears, tilted faces: probes p5, q2, 2026-10-25),
 * so this is the fallback the Style it panel uses. It is an estimate and is labelled as one in the UI.
 *
 * Method: downscale, keep pixels inside the classic YCbCr skin box (Chai & Ngan 1999) and away from
 * highlights/shadows, then take the per-channel median. Coverage is reported so the UI can refuse a weak read.
 */
export interface SkinToneEstimate { hex: string; coverage: number; samples: number }

export const MIN_SKIN_COVERAGE = 0.04

export function isSkinYCbCr(r: number, g: number, b: number) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return y > 70 && y < 235 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const hex2 = (v: number) => Math.round(v).toString(16).padStart(2, '0')

export async function estimateSkinTone(bytes: Buffer): Promise<SkinToneEstimate | null> {
  const { data, info } = await sharp(bytes).rotate().resize({ width: 240, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const rs: number[] = [], gs: number[] = [], bs: number[] = []
  const total = info.width * info.height
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (isSkinYCbCr(r, g, b)) { rs.push(r); gs.push(g); bs.push(b) }
  }
  const coverage = rs.length / total
  if (coverage < MIN_SKIN_COVERAGE) return null
  return { hex: `#${hex2(median(rs))}${hex2(median(gs))}${hex2(median(bs))}`.toUpperCase(), coverage, samples: rs.length }
}
