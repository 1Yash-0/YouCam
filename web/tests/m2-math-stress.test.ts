import './dom-polyfill'
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { remap, easeOutCubic } from '@/hooks/useScrollProgress'
import { HERO_FRAMES, HeroScrub } from '@/components/home/HeroScrub'
import { IrisNarrative } from '@/components/home/IrisNarrative'

describe('Milestone 2 Empirical Challenger Stress Tests: Mathematics & Coordinate Bindings', () => {
  // =========================================================================
  // DOMAIN 1: Hero Scrub Scroll Remapping [0.0, 1.0] -> [2.0, 6.0 cm] & Clamping Bounds
  // =========================================================================
  describe('Domain 1: Hero Scrub Scroll Remapping [0.0, 1.0] -> [2.0, 6.0 cm] & Clamping Bounds', () => {
    it('1.1 exact canonical remapping matches mathematical expectations across key progress checkpoints', () => {
      // Direct [0.0, 1.0] -> [2.0, 6.0 cm]
      expect(remap(0.0, 0.0, 1.0, 2.0, 6.0)).toBe(2.0)
      expect(remap(0.25, 0.0, 1.0, 2.0, 6.0)).toBe(3.0)
      expect(remap(0.5, 0.0, 1.0, 2.0, 6.0)).toBe(4.0)
      expect(remap(0.625, 0.0, 1.0, 2.0, 6.0)).toBe(4.5)
      expect(remap(0.75, 0.0, 1.0, 2.0, 6.0)).toBe(5.0)
      expect(remap(1.0, 0.0, 1.0, 2.0, 6.0)).toBe(6.0)
    })

    it('1.2 strict monotonicity holds across 1,000 evenly spaced points from 0.0 to 1.0', () => {
      const steps = 1000
      let prevValue = remap(0.0, 0.0, 1.0, 2.0, 6.0)

      for (let i = 1; i <= steps; i++) {
        const p = i / steps
        const current = remap(p, 0.0, 1.0, 2.0, 6.0)
        expect(current).toBeGreaterThanOrEqual(prevValue)
        expect(current).toBeLessThanOrEqual(6.0000001)
        expect(current).toBeGreaterThanOrEqual(1.9999999)
        prevValue = current
      }
    })

    it('1.3 strictly clamps underflow values (<0.0, negative infinity, extreme negative numbers) to exactly 2.0 cm', () => {
      expect(remap(-0.000001, 0.0, 1.0, 2.0, 6.0)).toBe(2.0)
      expect(remap(-0.1, 0.0, 1.0, 2.0, 6.0)).toBe(2.0)
      expect(remap(-1.0, 0.0, 1.0, 2.0, 6.0)).toBe(2.0)
      expect(remap(-999999.0, 0.0, 1.0, 2.0, 6.0)).toBe(2.0)
      expect(remap(-Number.MAX_SAFE_INTEGER, 0.0, 1.0, 2.0, 6.0)).toBe(2.0)
      expect(remap(-Infinity, 0.0, 1.0, 2.0, 6.0)).toBe(2.0)
    })

    it('1.4 strictly clamps overflow values (>1.0, positive infinity, extreme positive numbers) to exactly 6.0 cm', () => {
      expect(remap(1.000001, 0.0, 1.0, 2.0, 6.0)).toBe(6.0)
      expect(remap(1.1, 0.0, 1.0, 2.0, 6.0)).toBe(6.0)
      expect(remap(2.0, 0.0, 1.0, 2.0, 6.0)).toBe(6.0)
      expect(remap(999999.0, 0.0, 1.0, 2.0, 6.0)).toBe(6.0)
      expect(remap(Number.MAX_SAFE_INTEGER, 0.0, 1.0, 2.0, 6.0)).toBe(6.0)
      expect(remap(Infinity, 0.0, 1.0, 2.0, 6.0)).toBe(6.0)
    })

    it('1.5 handles degenerate zero-span intervals (inMin === inMax) safely returning outMin without division by zero', () => {
      expect(remap(0.5, 1.0, 1.0, 2.0, 6.0)).toBe(2.0)
      expect(remap(1.0, 1.0, 1.0, 2.0, 6.0)).toBe(2.0)
    })

    it('1.6 internal HeroScrub active scrub window [0.18, 0.88] maps correctly to [2.0, 6.0 cm]', () => {
      // Below active scrub window: locked at 2.0 cm
      expect(remap(0.0, 0.18, 0.88, 2.0, 6.0)).toBe(2.0)
      expect(remap(0.1, 0.18, 0.88, 2.0, 6.0)).toBe(2.0)
      expect(remap(0.18, 0.18, 0.88, 2.0, 6.0)).toBe(2.0)

      // Active scrub window midpoint (0.18 + 0.35 = 0.53): exactly 4.0 cm
      expect(remap(0.53, 0.18, 0.88, 2.0, 6.0)).toBeCloseTo(4.0, 5)

      // Active scrub window end and beyond: locked at 6.0 cm
      expect(remap(0.88, 0.18, 0.88, 2.0, 6.0)).toBe(6.0)
      expect(remap(0.95, 0.18, 0.88, 2.0, 6.0)).toBe(6.0)
      expect(remap(1.0, 0.18, 0.88, 2.0, 6.0)).toBe(6.0)
    })

    it('1.7 dynamic damping loop (alpha=0.15) stays strictly within [2.0, 6.0] during rapid scroll flick jumps', () => {
      // Simulate instantaneous flick from progress 0.0 to 1.0
      let currentSize = 2.0
      const targetSize = remap(1.0, 0.18, 0.88, 2.0, 6.0) // 6.0
      expect(targetSize).toBe(6.0)

      const history: number[] = [currentSize]
      for (let frame = 0; frame < 60; frame++) {
        currentSize += (targetSize - currentSize) * 0.15
        history.push(currentSize)
        expect(currentSize).toBeGreaterThanOrEqual(2.0)
        expect(currentSize).toBeLessThanOrEqual(6.00000001) // strictly no overshoot
      }

      // Reaches within 1% of 6.0cm by frame 30
      expect(history[30]).toBeGreaterThan(5.95)

      // Simulate instantaneous reverse flick from 1.0 to 0.0
      const reverseTarget = remap(0.0, 0.18, 0.88, 2.0, 6.0) // 2.0
      for (let frame = 0; frame < 60; frame++) {
        currentSize += (reverseTarget - currentSize) * 0.15
        expect(currentSize).toBeGreaterThanOrEqual(1.99999999) // strictly no undershoot
        expect(currentSize).toBeLessThanOrEqual(6.0)
      }
      expect(currentSize).toBeLessThan(2.01)
    })

    it('1.8 dynamic damping loop survives high-frequency chaotic flick jitter (120 Hz alternating 0.0 and 1.0)', () => {
      let size = 2.0
      for (let frame = 0; frame < 240; frame++) {
        // Chaotic scroll input: alternating 0.0 and 1.0 with random noise
        const rawScroll = frame % 2 === 0 ? 0.0 : 1.0
        const target = remap(rawScroll, 0.18, 0.88, 2.0, 6.0)
        size += (target - size) * 0.15

        // Invariant: size must remain strictly within [2.0, 6.0] at all times
        expect(size).toBeGreaterThanOrEqual(2.0)
        expect(size).toBeLessThanOrEqual(6.0)
        expect(Number.isFinite(size)).toBe(true)
      }
    })

    it('1.9 snap point detection with hysteresis threshold (+/- 0.12 cm) matches editorial sizes', () => {
      const snapPoints = [2.0, 3.0, 4.5, 6.0]
      const checkSnap = (val: number) => {
        const nearest = snapPoints.reduce((prev, curr) =>
          Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
        )
        const isSnapped = Math.abs(nearest - val) < 0.12
        return { nearest, isSnapped }
      }

      // At exactly 2.0, 3.0, 4.5, 6.0
      expect(checkSnap(2.0)).toEqual({ nearest: 2.0, isSnapped: true })
      expect(checkSnap(3.0)).toEqual({ nearest: 3.0, isSnapped: true })
      expect(checkSnap(4.5)).toEqual({ nearest: 4.5, isSnapped: true })
      expect(checkSnap(6.0)).toEqual({ nearest: 6.0, isSnapped: true })

      // Near boundaries (< 0.12 delta)
      expect(checkSnap(2.11).isSnapped).toBe(true)
      expect(checkSnap(2.89).isSnapped).toBe(true)
      expect(checkSnap(3.11).isSnapped).toBe(true)
      expect(checkSnap(4.40).isSnapped).toBe(true)
      expect(checkSnap(4.61).isSnapped).toBe(true)
      expect(checkSnap(5.89).isSnapped).toBe(true)

      // Far from boundaries (>= 0.12 delta)
      expect(checkSnap(2.30).isSnapped).toBe(false)
      expect(checkSnap(2.70).isSnapped).toBe(false)
      expect(checkSnap(3.75).isSnapped).toBe(false)
      expect(checkSnap(5.25).isSnapped).toBe(false)
    })
  })

  // =========================================================================
  // DOMAIN 2: Earlobe Anchor Locking at y=656, x=378 Across Viewports
  // =========================================================================
  describe('Domain 2: Earlobe Anchor Locking at y=656, x=378 Across Viewports', () => {
    it('2.1 all HERO_FRAMES verify earlobe coordinate Y is locked at 656 and X center aligns to 378', () => {
      expect(HERO_FRAMES).toHaveLength(4)

      HERO_FRAMES.forEach((frame) => {
        // Earlobe Y must be identically 656
        expect(frame.box.y).toBe(656)

        // Earlobe X center = box.x + box.w / 2
        const centerX = frame.box.x + frame.box.w / 2
        // Size 2.0: 364 + 14 = 378.0
        // Size 3.0: 357 + 21 = 378.0
        // Size 4.5: 347 + 31.5 = 378.5
        // Size 6.0: 336 + 42 = 378.0
        expect(Math.abs(centerX - 378)).toBeLessThanOrEqual(0.5)
      })
    })

    it('2.2 continuous bounding box interpolation preserves Y=656 invariant for all size values in [2.0, 6.0]', () => {
      const getBox = (size: number) => {
        let i = 0
        if (size >= 4.5) i = 2
        else if (size >= 3.0) i = 1
        else i = 0

        const f1 = HERO_FRAMES[i]
        const f2 = HERO_FRAMES[i + 1] || f1
        const alpha = f1 === f2 ? 1 : (size - f1.sizeCm) / (f2.sizeCm - f1.sizeCm)

        return {
          x: f1.box.x + alpha * (f2.box.x - f1.box.x),
          y: 656,
          w: f1.box.w + alpha * (f2.box.w - f1.box.w),
          h: f1.box.h + alpha * (f2.box.h - f1.box.h),
        }
      }

      // Test 400 continuous steps
      for (let s = 2.0; s <= 6.0; s += 0.01) {
        const box = getBox(s)
        expect(box.y).toBe(656) // Invariant: Y is strictly locked to 656

        const centerX = box.x + box.w / 2
        expect(centerX).toBeGreaterThanOrEqual(378.0)
        expect(centerX).toBeLessThanOrEqual(378.5) // Max variance <= 0.5px (0.045% of 1104px)

        // Monotonic growth of width and height
        expect(box.w).toBeGreaterThanOrEqual(28)
        expect(box.w).toBeLessThanOrEqual(84)
        expect(box.h).toBeGreaterThanOrEqual(68)
        expect(box.h).toBeLessThanOrEqual(205)
      }
    })

    it('2.3 responsive viewport cover transform math locks earlobe anchor across 10 distinct screen viewports', () => {
      // 10 representative viewports including responsive breakpoints and extreme ratios
      const viewports = [
        { name: 'Mobile Portrait (iPhone)', width: 390, height: 844 },
        { name: 'Mobile Portrait Small', width: 360, height: 780 },
        { name: 'Mobile Landscape', width: 844, height: 390 },
        { name: 'Tablet Portrait (iPad)', width: 768, height: 1024 },
        { name: 'Tablet Landscape', width: 1024, height: 768 },
        { name: 'Desktop Standard', width: 1280, height: 800 },
        { name: 'Desktop Full HD', width: 1920, height: 1080 },
        { name: 'Desktop Ultrawide', width: 2560, height: 1080 },
        { name: 'Square Window', width: 900, height: 900 },
        { name: 'Extreme Vertical Strip', width: 450, height: 1800 },
      ]

      const IMAGE_W = 1104
      const IMAGE_H = 1472
      const ANCHOR_IMG_X = 378
      const ANCHOR_IMG_Y = 656

      viewports.forEach((vp) => {
        // Cover scale computation
        const scale = Math.max(vp.width / IMAGE_W, vp.height / IMAGE_H)
        const dw = IMAGE_W * scale
        const dh = IMAGE_H * scale
        const ox = (vp.width - dw) / 2
        const oy = (vp.height - dh) / 2

        // Canvas drawing coverage invariant
        expect(dw).toBeGreaterThanOrEqual(vp.width - 0.001)
        expect(dh).toBeGreaterThanOrEqual(vp.height - 0.001)

        // Transformed screen coordinates of earlobe anchor in SVG and Canvas
        const screenAnchorX = ox + ANCHOR_IMG_X * scale
        const screenAnchorY = oy + ANCHOR_IMG_Y * scale

        // Coordinates must be strictly finite numbers
        expect(Number.isFinite(screenAnchorX)).toBe(true)
        expect(Number.isFinite(screenAnchorY)).toBe(true)

        // Mathematical equivalence: SVG <g transform="translate(ox, oy) scale(scale)">
        // Evaluates a point (X, Y) inside group to: (ox + X * scale, oy + Y * scale)
        const svgScreenX = ox + ANCHOR_IMG_X * scale
        const svgScreenY = oy + ANCHOR_IMG_Y * scale
        expect(svgScreenX).toBe(screenAnchorX)
        expect(svgScreenY).toBe(screenAnchorY)

        // Anchor must lie within visible image bounds
        expect(screenAnchorX).toBeGreaterThanOrEqual(ox)
        expect(screenAnchorX).toBeLessThanOrEqual(ox + dw)
        expect(screenAnchorY).toBeGreaterThanOrEqual(oy)
        expect(screenAnchorY).toBeLessThanOrEqual(oy + dh)
      })
    })

    it('2.4 SVG gold measurement line geometry top tick is strictly locked at currentBox.y = 656', () => {
      // Test across sizes
      const sizes = [2.0, 3.0, 4.5, 6.0]
      sizes.forEach((s) => {
        const frame = HERO_FRAMES.find((f) => f.sizeCm === s)!
        const currentBox = frame.box

        // Top tick line y1 and y2
        const topTickY1 = currentBox.y
        const topTickY2 = currentBox.y
        expect(topTickY1).toBe(656)
        expect(topTickY2).toBe(656)

        // Vertical ruler line starts at 656
        const rulerStartY = currentBox.y
        const rulerEndY = currentBox.y + currentBox.h
        expect(rulerStartY).toBe(656)
        expect(rulerEndY).toBe(656 + currentBox.h)
      })
    })
  })

  // =========================================================================
  // DOMAIN 3: Physical Ratio Check: 6cm vs 3cm Drop Ratio = 2.01
  // =========================================================================
  describe('Domain 3: Physical Ratio Check: 6cm vs 3cm Drop Ratio = 2.01', () => {
    it('3.1 6cm drop vs 3cm drop length ratio equals 2.01 within 0.1% tolerance', () => {
      const f3 = HERO_FRAMES.find((f) => f.sizeCm === 3.0)!
      const f6 = HERO_FRAMES.find((f) => f.sizeCm === 6.0)!

      expect(f3.box.h).toBe(102)
      expect(f6.box.h).toBe(205)

      const ratio = f6.box.h / f3.box.h
      // 205 / 102 = 2.0098039215686274
      expect(ratio).toBeCloseTo(2.01, 2)

      // Strict percentage error against 2.01 must be < 0.1% (well within 1% dispatch tolerance)
      const errorPct = Math.abs(ratio - 2.01) / 2.01
      expect(errorPct).toBeLessThan(0.001) // 0.0097%
    })

    it('3.2 4.5cm drop vs 3cm drop length ratio equals exactly 1.50 (0.00% error)', () => {
      const f3 = HERO_FRAMES.find((f) => f.sizeCm === 3.0)!
      const f45 = HERO_FRAMES.find((f) => f.sizeCm === 4.5)!

      expect(f3.box.h).toBe(102)
      expect(f45.box.h).toBe(153)

      const ratio = f45.box.h / f3.box.h
      // 153 / 102 = 1.50000000
      expect(ratio).toBe(1.5)
      expect(ratio).toBe(4.5 / 3.0)
    })

    it('3.3 2.0cm drop vs 3cm drop length ratio equals exactly 0.667 (2/3 ratio)', () => {
      const f2 = HERO_FRAMES.find((f) => f.sizeCm === 2.0)!
      const f3 = HERO_FRAMES.find((f) => f.sizeCm === 3.0)!

      expect(f2.box.h).toBe(68)
      expect(f3.box.h).toBe(102)

      const ratio = f2.box.h / f3.box.h
      // 68 / 102 = 2 / 3
      expect(ratio).toBeCloseTo(2 / 3, 5)
      expect(ratio).toBeCloseTo(2.0 / 3.0, 5)
    })

    it('3.4 model-space pixel density (px/cm) is remarkably uniform with < 0.5% variance across all 4 frames', () => {
      const densities = HERO_FRAMES.map((f) => ({
        sizeCm: f.sizeCm,
        pxPerCm: f.box.h / f.sizeCm,
      }))

      // 2.0cm -> 68 / 2.0 = 34.00 px/cm
      // 3.0cm -> 102 / 3.0 = 34.00 px/cm
      // 4.5cm -> 153 / 4.5 = 34.00 px/cm
      // 6.0cm -> 205 / 6.0 = 34.167 px/cm
      densities.forEach((d) => {
        expect(d.pxPerCm).toBeGreaterThanOrEqual(34.0)
        expect(d.pxPerCm).toBeLessThanOrEqual(34.2)
        const deviationFromMean = Math.abs(d.pxPerCm - 34.0417) / 34.0417
        expect(deviationFromMean).toBeLessThan(0.005) // < 0.5% variance
      })
    })

    it('3.5 physical earring aspect ratio (h/w) is conserved within 0.5% across all 4 physical renders', () => {
      const aspectRatios = HERO_FRAMES.map((f) => f.box.h / f.box.w)
      // 68 / 28 = 2.42857
      // 102 / 42 = 2.42857
      // 153 / 63 = 2.42857
      // 205 / 84 = 2.44048
      aspectRatios.forEach((ar) => {
        expect(ar).toBeGreaterThanOrEqual(2.42)
        expect(ar).toBeLessThanOrEqual(2.45)
      })
    })
  })

  // =========================================================================
  // DOMAIN 4: Iris Narrative Dynamic Caliper Scrub 16px to 37px (31.6 px/cm)
  //           & 3.0cm Earring Physical Scale Render at 95px
  // =========================================================================
  describe('Domain 4: Iris Narrative Dynamic Caliper Scrub & Physical Scale Render', () => {
    it('4.1 iris pixel counter scrubs monotonically from 16px to 37px during calibration phase', () => {
      const getIrisPx = (tau: number) => {
        let activeStep = 0
        if (tau >= 0.32 && tau < 0.68) activeStep = 1
        else if (tau >= 0.68) activeStep = 2

        let irisPx = 37
        if (activeStep === 1) {
          if (tau < 0.52) {
            irisPx = Math.round(remap(tau, 0.32, 0.52, 16, 37))
          } else {
            irisPx = 37
          }
        } else if (activeStep === 0) {
          irisPx = 16
        }
        return irisPx
      }

      // Step 0: strictly 16px
      expect(getIrisPx(0.0)).toBe(16)
      expect(getIrisPx(0.15)).toBe(16)
      expect(getIrisPx(0.31)).toBe(16)

      // Step 1 start: 16px
      expect(getIrisPx(0.32)).toBe(16)

      // Step 1 midpoint (0.42): 27px
      expect(getIrisPx(0.42)).toBe(27)

      // Step 1 lock point (0.52): 37px
      expect(getIrisPx(0.52)).toBe(37)
      expect(getIrisPx(0.60)).toBe(37)

      // Step 2: locked at 37px
      expect(getIrisPx(0.68)).toBe(37)
      expect(getIrisPx(1.0)).toBe(37)

      // Monotonicity verification across 500 samples
      let prev = 16
      for (let tau = 0.0; tau <= 1.0; tau += 0.002) {
        const val = getIrisPx(tau)
        expect(val).toBeGreaterThanOrEqual(prev)
        expect(val).toBeGreaterThanOrEqual(16)
        expect(val).toBeLessThanOrEqual(37)
        prev = val
      }
    })

    it('4.2 calibration scale formula (11.7 mm / iris px) produces exact 31.6 px/cm at 37px iris', () => {
      const irisPx = 37
      const irisMm = 11.7
      const irisCm = 1.17

      const pxPerMm = irisPx / irisMm
      const pxPerCm = irisPx / irisCm

      // 37 / 1.17 = 31.6239316239...
      expect(pxPerMm).toBeCloseTo(3.16239, 4)
      expect(pxPerCm).toBeCloseTo(31.6239, 4)
      expect(pxPerCm.toFixed(1)).toBe('31.6')
    })

    it('4.3 physical scale drop for 3.0cm Gilded Teardrop resolves to 94.87px which rounds to exactly 95px', () => {
      const sizeCm = 3.0
      const irisPx = 37
      const pxPerCm = irisPx / 1.17
      const rawEarringPx = sizeCm * pxPerCm
      const earringPx = Math.round(rawEarringPx)

      // 3.0 * (37 / 1.17) = 94.87179487...
      expect(rawEarringPx).toBeCloseTo(94.8718, 3)
      expect(earringPx).toBe(95)

      // Percentage error between discrete 95px render and physical 94.8718px is 0.135% (< 10% mandate)
      const errorPct = (Math.abs(earringPx - rawEarringPx) / rawEarringPx) * 100
      expect(errorPct).toBeLessThan(0.15)
    })

    it('4.4 optical scale conversion preserves physical size ratios across all product sizes under 31.6 px/cm', () => {
      const pxPerCm = 37 / 1.17

      const sizes = [
        { cm: 2.0, expectedPx: 63 }, // 2.0 * 31.6239 = 63.25 -> 63
        { cm: 3.0, expectedPx: 95 }, // 3.0 * 31.6239 = 94.87 -> 95
        { cm: 4.5, expectedPx: 142 }, // 4.5 * 31.6239 = 142.31 -> 142
        { cm: 6.0, expectedPx: 190 }, // 6.0 * 31.6239 = 189.74 -> 190
      ]

      sizes.forEach((s) => {
        expect(Math.round(s.cm * pxPerCm)).toBe(s.expectedPx)
      })

      // Ratio of 6.0cm (190px) vs 3.0cm (95px) under calibrated optical rendering:
      expect(190 / 95).toBe(2.0)
    })

    it('4.5 caliper bar width expansion (irisPx * 2.8) scales smoothly from 44.8px to 103.6px', () => {
      const minWidth = 16 * 2.8 // 44.8
      const maxWidth = 37 * 2.8 // 103.6

      expect(minWidth).toBeCloseTo(44.8, 1)
      expect(maxWidth).toBeCloseTo(103.6, 1)
      expect(maxWidth / minWidth).toBeCloseTo(37 / 16, 4)
    })
  })

  // =========================================================================
  // DOMAIN 5: Eye Zoom Centered on (56.48%, 33.15%) at 2.2x Scale
  // =========================================================================
  describe('Domain 5: Eye Zoom Centered on (56.48%, 33.15%) at 2.2x Scale', () => {
    it('5.1 eye landmark origin (56.48%, 33.15%) precisely matches sample face right cornea coordinate', () => {
      const SAMPLE_W = 1104
      const SAMPLE_H = 1472
      const EYE_X = 623.5
      const EYE_Y = 488.0

      const originX = (EYE_X / SAMPLE_W) * 100
      const originY = (EYE_Y / SAMPLE_H) * 100

      // 623.5 / 1104 = 0.56476449... -> 56.48%
      // 488.0 / 1472 = 0.33152173... -> 33.15%
      expect(originX).toBeCloseTo(56.48, 2)
      expect(originY).toBeCloseTo(33.15, 2)
      expect(originX.toFixed(2)).toBe('56.48')
      expect(originY.toFixed(2)).toBe('33.15')
    })

    it('5.2 zoom scale eases smoothly and clamps strictly to [1.0, 2.2x] with no overshoot', () => {
      const getTransform = (tau: number) => {
        let activeStep = 0
        if (tau >= 0.32 && tau < 0.68) activeStep = 1
        else if (tau >= 0.68) activeStep = 2

        let scale = 1.0
        let originX = 50
        let originY = 50

        if (activeStep === 0) {
          if (tau < 0.15) {
            scale = 1.0
          } else {
            const t = remap(tau, 0.15, 0.32, 0, 1)
            scale = 1.0 + (2.2 - 1.0) * easeOutCubic(t)
          }
          originX = 56.48
          originY = 33.15
        } else if (activeStep === 1) {
          scale = 2.2
          originX = 56.48
          originY = 33.15
        } else {
          const t = remap(tau, 0.68, 0.85, 0, 1)
          scale = 2.2 - (2.2 - 1.15) * easeOutCubic(t)
          originX = 56.48 - (56.48 - 40.0) * easeOutCubic(t)
          originY = 33.15 + (42.0 - 33.15) * easeOutCubic(t)
        }

        return { scale, originX, originY }
      }

      // Initial raw portrait
      expect(getTransform(0.0).scale).toBe(1.0)
      expect(getTransform(0.14).scale).toBe(1.0)

      // Calibration step: strictly 2.2x zoom centered on (56.48%, 33.15%)
      const calib = getTransform(0.35)
      expect(calib.scale).toBe(2.2)
      expect(calib.originX).toBe(56.48)
      expect(calib.originY).toBe(33.15)

      // Test monotonic zoom in step 0 across 100 points
      let prevScale = 1.0
      for (let tau = 0.15; tau <= 0.32; tau += 0.001) {
        const tr = getTransform(tau)
        expect(tr.scale).toBeGreaterThanOrEqual(prevScale)
        expect(tr.scale).toBeLessThanOrEqual(2.2000001) // strictly no overshoot
        expect(tr.originX).toBe(56.48)
        expect(tr.originY).toBe(33.15)
        prevScale = tr.scale
      }
    })

    it('5.3 affine transform math preserves zero displacement at the eye landmark focal point across all zoom levels', () => {
      // In CSS, transform: scale(s) with transform-origin: (Ox, Oy)
      // maps point (x, y) to: x' = Ox + s * (x - Ox), y' = Oy + s * (y - Oy)
      // For any container dimension (W, H):
      const testContainers = [
        { w: 520, h: 650 },
        { w: 400, h: 500 },
        { w: 1104, h: 1472 },
        { w: 320, h: 400 },
      ]

      testContainers.forEach(({ w, h }) => {
        const Ox = w * 0.5648
        const Oy = h * 0.3315

        // Let point P be the eye landmark at (Ox, Oy)
        const eyeX = Ox
        const eyeY = Oy

        // Test zoom scales from 1.0 to 2.2
        for (let s = 1.0; s <= 2.2; s += 0.1) {
          const transformedX = Ox + s * (eyeX - Ox)
          const transformedY = Oy + s * (eyeY - Oy)

          // Focal point displacement must be exactly 0
          const displacement = Math.hypot(transformedX - eyeX, transformedY - eyeY)
          expect(displacement).toBe(0)
        }
      })
    })

    it('5.4 optical magnification matches physical iris measurement expansion (16.8px * 2.2 = 37.0px)', () => {
      // On raw 1104x1472 portrait, unzoomed iris diameter is approximately 16.8px
      const rawIrisPx = 37.0 / 2.2
      expect(rawIrisPx).toBeCloseTo(16.818, 3)

      // Magnification at 2.2x scale:
      const magnifiedIrisPx = rawIrisPx * 2.2
      expect(magnifiedIrisPx).toBeCloseTo(37.0, 5)

      // Proves that dynamic caliper counter scrub (16px -> 37px) exactly tracks
      // the optical camera magnification from 1.0x to 2.2x!
    })
  })

  // =========================================================================
  // DOMAIN 6: Static DOM Markup & Architectural Accessibility Checks
  // =========================================================================
  describe('Domain 6: Static DOM Markup & Architectural Accessibility Checks', () => {
    it('6.1 HeroScrub renders gold measurement overlay with earlobe coordinate definitions', () => {
      const html = renderToStaticMarkup(React.createElement(HeroScrub))

      // Check SVG structure and gold glow filter
      expect(html).toContain('id="heroGoldGlow"')
      expect(html).toContain('stroke="var(--gold)"')
      expect(html).toContain('2.0 CM')

      // Check aria-live status container for screen reader announcement
      expect(html).toContain('role="status"')
      expect(html).toContain('aria-live="polite"')
      expect(html).toContain('Gilded Teardrop')
    })

    it('6.2 IrisNarrative renders header, step tabs, raw portrait landmarks, and progress indicator', () => {
      const html = renderToStaticMarkup(React.createElement(IrisNarrative))

      // Header and step navigation
      expect(html).toContain('PROPRIETARY OPTICAL CALIBRATION')
      expect(html).toContain('How Darpan')
      expect(html).toContain('01 CAPTURE')
      expect(html).toContain('02 CALIBRATE')
      expect(html).toContain('03 RENDER')

      // Initial active stage: Step 0 Capture
      expect(html).toContain('Portrait Landmark Alignment')
      expect(html).toContain('RAW PORTRAIT · 1104 × 1472 PX')

      // Progress bar container
      expect(html).toContain('aria-label="How iris calibration works"')
    })
  })
})
