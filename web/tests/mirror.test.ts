import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'
import products from '../data/products.json'
import {
  MIRROR,
  blend,
  chapterAt,
  framePos,
  nearestFrame,
  parseLabel,
  progressForChapterStart,
  rulerOffsetPx,
  toMm,
} from '@/lib/mirror'

// Label rounding step per chapter, in the chapter unit. Each label must sit
// within half a step of its measured size.
const LABEL_STEP: Record<string, number> = { ear: 0.1, neck: 1, ring: 0.5, watch: 1 }

const MIRROR_DIR = fileURLToPath(new URL('../public/mirror', import.meta.url))

describe('chapterAt', () => {
  it('starts on the first chapter with no progress', () => {
    expect(chapterAt(0, 4)).toEqual({ chapter: 0, local: 0, transition: 0 })
  })

  it('ends on the last chapter at full local progress with no fade', () => {
    expect(chapterAt(1, 4)).toEqual({ chapter: 3, local: 1, transition: 0 })
  })

  it('clamps progress outside 0..1', () => {
    expect(chapterAt(-0.5, 4)).toEqual({ chapter: 0, local: 0, transition: 0 })
    expect(chapterAt(1.5, 4)).toEqual({ chapter: 3, local: 1, transition: 0 })
  })

  it('holds frames for the first 80% of a chapter', () => {
    // q = 0.1 / 0.25 = 0.4 of chapter 0, so local = 0.4 / 0.8 = 0.5
    const at = chapterAt(0.1, 4)
    expect(at.chapter).toBe(0)
    expect(at.local).toBeCloseTo(0.5, 9)
    expect(at.transition).toBe(0)
  })

  it('reaches local 1 exactly as the cross-fade begins', () => {
    // q = 0.8 = 1 - shutter
    const at = chapterAt(0.2, 4)
    expect(at.local).toBeCloseTo(1, 9)
    expect(at.transition).toBeCloseTo(0, 9)
  })

  it('cross-fades halfway through the last 20% of chapter 0', () => {
    // q = 0.9, so transition = (0.9 - 0.8) / 0.2 = 0.5
    const at = chapterAt(0.225, 4)
    expect(at.chapter).toBe(0)
    expect(at.local).toBe(1)
    expect(at.transition).toBeCloseTo(0.5, 9)
  })

  it('starts every chapter at its own boundary', () => {
    for (let c = 0; c < 4; c++) {
      const at = chapterAt(progressForChapterStart(c, 4), 4)
      expect(at.chapter).toBe(c)
      expect(at.local).toBeCloseTo(0, 9)
    }
  })

  it('never cross-fades out of the final chapter', () => {
    // q = (0.9 - 0.75) / 0.25 = 0.6 on the last chapter
    const at = chapterAt(0.9, 4)
    expect(at.chapter).toBe(3)
    expect(at.local).toBeCloseTo(0.6, 9)
    expect(at.transition).toBe(0)
  })
})

describe('frame maths', () => {
  it('maps a chapter-local position onto frame indexes', () => {
    expect(framePos(0, 5)).toBe(0)
    expect(framePos(0.5, 5)).toBe(2)
    expect(framePos(1, 5)).toBe(4)
    expect(framePos(1.7, 5)).toBe(4)
    expect(framePos(-0.3, 5)).toBe(0)
  })

  it('snaps to the nearest whole frame and stays in range', () => {
    expect(nearestFrame(2.4, 5)).toBe(2)
    expect(nearestFrame(2.5, 5)).toBe(3)
    expect(nearestFrame(-0.4, 5)).toBe(0)
    expect(nearestFrame(9, 5)).toBe(4)
  })

  it('splits a fractional position into neighbouring frames', () => {
    expect(blend(2.25)).toEqual({ a: 2, b: 3, t: 0.25 })
    expect(blend(3)).toEqual({ a: 3, b: 3, t: 0 })
  })

  it('blends from a chapter-local position to a frame mix', () => {
    // framePos(0.3, 5) = 1.2, so frames 1 and 2 at 20% toward frame 2
    const mix = blend(framePos(0.3, 5))
    expect(mix.a).toBe(1)
    expect(mix.b).toBe(2)
    expect(mix.t).toBeCloseTo(0.2, 9)
  })
})

describe('units and ruler', () => {
  it('converts chapter units to millimetres', () => {
    expect(toMm(6, 'cm')).toBe(60)
    expect(toMm(34, 'mm')).toBe(34)
  })

  it('turns a size into a ruler length in CSS pixels', () => {
    expect(rulerOffsetPx(2, 'cm', 3)).toBe(60)
    expect(rulerOffsetPx(4, 'mm', 3)).toBe(12)
  })

  it('places chapter starts evenly along the scroll', () => {
    expect(progressForChapterStart(0, 4)).toBe(0)
    expect(progressForChapterStart(2, 4)).toBe(0.5)
  })
})

describe('parseLabel', () => {
  it('splits approximate labels into prefix, number and unit', () => {
    expect(parseLabel('about 9.5 mm')).toEqual({ prefix: 'about', number: '9.5', unit: 'mm' })
    expect(parseLabel('about 39 cm')).toEqual({ prefix: 'about', number: '39', unit: 'cm' })
  })

  it('parses exact labels without a prefix', () => {
    expect(parseLabel('1.9 cm')).toEqual({ prefix: '', number: '1.9', unit: 'cm' })
    expect(parseLabel('32 mm')).toEqual({ prefix: '', number: '32', unit: 'mm' })
  })

  it('ignores case and surrounding spaces', () => {
    expect(parseLabel('  ABOUT 5 MM ')).toEqual({ prefix: 'about', number: '5', unit: 'mm' })
  })

  it('keeps unrecognised text whole rather than inventing a unit', () => {
    expect(parseLabel('roughly 3 cm')).toEqual({ prefix: '', number: 'roughly 3 cm', unit: '' })
  })
})

describe('mirror manifest', () => {
  it('has the four chapters in order: ear, neck, ring, watch', () => {
    expect(MIRROR.map(chapter => chapter.id)).toEqual(['ear', 'neck', 'ring', 'watch'])
  })

  it('links each chapter to its catalogue product page', () => {
    for (const chapter of MIRROR) {
      expect(chapter.href).toBe(`/p/${chapter.productId}`)
      expect(products.some(product => product.id === chapter.productId)).toBe(true)
    }
  })

  it('keeps frame indexes aligned with frame order', () => {
    for (const chapter of MIRROR) {
      chapter.frames.forEach((frame, k) => expect(frame.i).toBe(k))
    }
  })

  it('keeps measured sizes non-decreasing within each chapter', () => {
    for (const chapter of MIRROR) {
      for (let k = 1; k < chapter.frames.length; k++) {
        expect(chapter.frames[k].measured).toBeGreaterThanOrEqual(chapter.frames[k - 1].measured)
      }
    }
  })

  it('gives every frame a unique label within its chapter', () => {
    for (const chapter of MIRROR) {
      const labels = chapter.frames.map(frame => frame.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('writes every label in the chapter unit, within rounding of the measured size', () => {
    for (const chapter of MIRROR) {
      const step = LABEL_STEP[chapter.id]
      expect(step, `label step for chapter ${chapter.id}`).toBeGreaterThan(0)
      for (const frame of chapter.frames) {
        const parsed = parseLabel(frame.label)
        expect(parsed.unit, frame.label).toBe(chapter.unit)
        expect(Math.abs(Number(parsed.number) - frame.measured), frame.label).toBeLessThanOrEqual(step / 2 + 1e-9)
      }
    }
  })

  it('ships both frame files for every frame', () => {
    const missing: string[] = []
    for (const chapter of MIRROR) {
      for (const frame of chapter.frames) {
        for (const variant of ['l', 's']) {
          const file = path.join(MIRROR_DIR, chapter.id, `${frame.i}-${variant}.webp`)
          if (!fs.existsSync(file)) missing.push(path.relative(MIRROR_DIR, file))
        }
      }
    }
    expect(missing).toEqual([])
  })
})
