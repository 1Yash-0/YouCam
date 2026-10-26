// Mirror: pure scroll-to-size maths for the homepage size sequence.
// No DOM access, so everything here is unit-tested in node.
import manifest from '../../public/mirror/manifest.json'

export type MirrorUnit = 'cm' | 'mm'

export type MirrorFrame = {
  /** Zero-based index. Frame files are named <i>-l.webp and <i>-s.webp. */
  i: number
  /** Numeric size in the chapter unit. */
  value: number
  /** Shopper-facing label, for example "about 39 cm". */
  label: string
  /** Measured size in the chapter unit. */
  measured: number
}

export type MirrorChapter = {
  id: string
  title: string
  productId: string
  href: string
  /** What the ruler measures, for example "Drop" or "Chain". */
  measure: string
  unit: MirrorUnit
  /** Ruler scale: on-screen CSS pixels per millimetre at a 960 px viewport. */
  pxPerMmAt960: number
  frames: MirrorFrame[]
}

export type ChapterPosition = {
  chapter: number
  /** Progress through the frames of this chapter, 0..1. */
  local: number
  /** Progress through the cross-fade into the next chapter, 0..1. */
  transition: number
}

export type ParsedLabel = {
  prefix: 'about' | ''
  number: string
  unit: string
}

export const MIRROR: MirrorChapter[] = manifest as MirrorChapter[]

/** Clamp to [lo, hi]. NaN maps to lo, so bad scroll input never reaches the layout. */
function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

/**
 * Splits scroll progress p (0..1) across n chapters. Each chapter holds its
 * frames for (1 - shutter) of its span, then cross-fades into the next chapter
 * during the final `shutter` share. The last chapter has no fade.
 */
export function chapterAt(p: number, n: number, shutter = 0.2): ChapterPosition {
  const pos = clamp(p, 0, 1)
  const span = 1 / n
  const chapter = Math.min(n - 1, Math.floor(pos / span))
  const q = (pos - chapter * span) / span
  if (chapter === n - 1) return { chapter, local: clamp(q, 0, 1), transition: 0 }
  const hold = 1 - shutter
  return {
    chapter,
    local: clamp(q / hold, 0, 1),
    transition: q > hold ? (q - hold) / shutter : 0,
  }
}

/** Maps a chapter-local position (0..1) onto a fractional frame index. */
export function framePos(local: number, count: number): number {
  return clamp(local, 0, 1) * (count - 1)
}

/** Rounds a fractional frame position to the nearest valid frame index. */
export function nearestFrame(pos: number, count: number): number {
  return clamp(Math.round(pos), 0, count - 1)
}

/** Splits a fractional frame position into its two neighbours and the mix between them. */
export function blend(pos: number): { a: number; b: number; t: number } {
  const a = Math.floor(pos)
  return { a, b: Math.ceil(pos), t: pos - a }
}

/** Converts a size in the chapter unit to millimetres. */
export function toMm(value: number, unit: MirrorUnit): number {
  return unit === 'cm' ? value * 10 : value
}

/** On-screen length in CSS pixels of a size, given the ruler's pixels per millimetre. */
export function rulerOffsetPx(value: number, unit: MirrorUnit, pxPerMm: number): number {
  return toMm(value, unit) * pxPerMm
}

/** Scroll progress at which chapter `chapter` begins. */
export function progressForChapterStart(chapter: number, n: number): number {
  return chapter / n
}

const LABEL_PATTERN = /^(about\s+)?(\d+(?:\.\d+)?)\s*(mm|cm)$/i

/**
 * Splits a shopper-facing label such as "about 9.5 mm" into its parts.
 * Text that does not match is returned whole in `number` with an empty unit,
 * so it still displays without a unit being invented.
 */
export function parseLabel(label: string): ParsedLabel {
  const text = label.trim()
  const match = LABEL_PATTERN.exec(text)
  if (!match) return { prefix: '', number: text, unit: '' }
  return {
    prefix: match[1] ? 'about' : '',
    number: match[2],
    unit: match[3].toLowerCase(),
  }
}
