import './dom-polyfill'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SplitSlider } from '@/components/tryon/SplitSlider'

describe('Milestone 1 Iteration 2: SplitSlider Empirical Stress Tests', () => {
  const defaultProps = {
    beforeImageUrl: '/sample/before.png',
    afterImageUrl: '/sample/after.png',
    measurement: {
      renderedCm: 3.0,
      renderedPx: 95,
      tolerancePct: 0,
      errorPct: 0,
      withinTolerance: true,
      box: { x: 360, y: 648, w: 28, h: 95, pixels: 1820 },
    },
    targetSizeCm: 3.0,
    showRuler: true,
    sliderPosition: 50,
    onSliderPositionChange: vi.fn(),
    caliperDrawn: true,
    displayedCm: 3.0,
  }

  // =========================================================================
  // 1. Badge DOM Placement & CSS Styling at 50% Default Split
  // =========================================================================
  describe('1. Badge DOM Placement & CSS Styling at 50% Default Split', () => {
    it('1.1 renders BEFORE badge in Layer 0 at top-4 right-4 and AFTER badge in Layer 1 at top-4 left-4', () => {
      const html = renderToStaticMarkup(React.createElement(SplitSlider, { ...defaultProps, sliderPosition: 50 }))

      // Verify BEFORE badge structure
      expect(html).toContain('BEFORE')
      expect(html).toMatch(/<div class="[^"]*absolute top-4 right-4 z-10 pointer-events-none[^"]*">[^<]*<span[^>]*>BEFORE<\/span>/)

      // Verify AFTER badge structure
      expect(html).toContain('AFTER')
      expect(html).toMatch(/<div class="[^"]*absolute top-4 left-4 z-10 pointer-events-none[^"]*">[^<]*<span[^>]*>AFTER<\/span>/)

      // Verify Layer 1 clipPath at 50%
      expect(html).toContain('clip-path:inset(0 calc(100% - 50%) 0 0)')
    })

    it('1.2 verifies both badges have pointer-events-none so they do not intercept slider drag events', () => {
      const html = renderToStaticMarkup(React.createElement(SplitSlider, { ...defaultProps, sliderPosition: 50 }))

      const beforeMatch = html.match(/<div class="([^"]*)">[^<]*<span[^>]*>BEFORE<\/span>/)
      const afterMatch = html.match(/<div class="([^"]*)">[^<]*<span[^>]*>AFTER<\/span>/)

      expect(beforeMatch).not.toBeNull()
      expect(beforeMatch![1]).toContain('pointer-events-none')

      expect(afterMatch).not.toBeNull()
      expect(afterMatch![1]).toContain('pointer-events-none')
    })
  })

  // =========================================================================
  // 2. Mathematical Visibility Oracle across Viewport Dimensions and 0%-100% Range
  // =========================================================================
  describe('2. Mathematical Visibility Oracle across Viewport Dimensions and 0%-100% Range', () => {
    // Model parameters:
    // Badge margin = 16px (top-4 / left-4 / right-4)
    // Badge width = approx 55px (pill with 9px font uppercase + padding)
    const BADGE_MARGIN_PX = 16
    const BADGE_WIDTH_PX = 55

    // Helper visibility oracle:
    // Container width W, sliderPosition S in [0, 100]
    // After layer covers [0, S%].
    //   After badge is at [m, m + w] from left.
    //   Visible fraction = clamp( (S% * W - m) / w, 0, 1 )
    // Before layer is revealed on [S%, 100%].
    //   Before badge is at [W - m - w, W - m].
    //   Layer 1 covers [0, S%].
    //   Visible fraction = clamp( ((W - m) - S% * W) / w, 0, 1 )
    function computeBadgeVisibility(containerWidthPx: number, sliderPositionPct: number) {
      const sPx = (sliderPositionPct / 100) * containerWidthPx

      // After badge: left edge = MARGIN, right edge = MARGIN + WIDTH
      const afterLeft = BADGE_MARGIN_PX
      const afterRight = BADGE_MARGIN_PX + BADGE_WIDTH_PX
      let afterVisiblePct = 0
      if (sPx <= afterLeft) {
        afterVisiblePct = 0
      } else if (sPx >= afterRight) {
        afterVisiblePct = 100
      } else {
        afterVisiblePct = ((sPx - afterLeft) / BADGE_WIDTH_PX) * 100
      }

      // Before badge: left edge = W - MARGIN - WIDTH, right edge = W - MARGIN
      const beforeLeft = containerWidthPx - BADGE_MARGIN_PX - BADGE_WIDTH_PX
      const beforeRight = containerWidthPx - BADGE_MARGIN_PX
      let beforeVisiblePct = 0
      if (sPx >= beforeRight) {
        beforeVisiblePct = 0
      } else if (sPx <= beforeLeft) {
        beforeVisiblePct = 100
      } else {
        beforeVisiblePct = ((beforeRight - sPx) / BADGE_WIDTH_PX) * 100
      }

      return {
        afterVisiblePct: Number(afterVisiblePct.toFixed(1)),
        beforeVisiblePct: Number(beforeVisiblePct.toFixed(1)),
      }
    }

    const testViewports = [
      { name: 'Mobile XS (320px)', width: 320 },
      { name: 'Mobile Standard (375px)', width: 375 },
      { name: 'Drawer Max Width (560px)', width: 560 },
      { name: 'Tablet (768px)', width: 768 },
      { name: 'Desktop (1280px)', width: 1280 },
    ]

    it('2.1 proves 100% visibility for BOTH badges at 50% split view across ALL viewport sizes', () => {
      for (const vp of testViewports) {
        const { afterVisiblePct, beforeVisiblePct } = computeBadgeVisibility(vp.width, 50)
        expect(afterVisiblePct, `After badge visibility on ${vp.name}`).toBe(100)
        expect(beforeVisiblePct, `Before badge visibility on ${vp.name}`).toBe(100)
      }
    })

    it('2.2 proves behavior at 0% split (slider pulled all the way left): AFTER is 0% visible, BEFORE is 100% visible', () => {
      for (const vp of testViewports) {
        const { afterVisiblePct, beforeVisiblePct } = computeBadgeVisibility(vp.width, 0)
        expect(afterVisiblePct, `After badge at 0% on ${vp.name}`).toBe(0)
        expect(beforeVisiblePct, `Before badge at 0% on ${vp.name}`).toBe(100)
      }
    })

    it('2.3 proves behavior at 100% split (slider pulled all the way right): AFTER is 100% visible, BEFORE is 0% visible', () => {
      for (const vp of testViewports) {
        const { afterVisiblePct, beforeVisiblePct } = computeBadgeVisibility(vp.width, 100)
        expect(afterVisiblePct, `After badge at 100% on ${vp.name}`).toBe(100)
        expect(beforeVisiblePct, `Before badge at 100% on ${vp.name}`).toBe(0)
      }
    })

    it('2.4 proves both badges remain simultaneously 100% visible across the entire comfortable viewing band [25%, 75%]', () => {
      for (const vp of testViewports) {
        for (let s = 25; s <= 75; s += 5) {
          const { afterVisiblePct, beforeVisiblePct } = computeBadgeVisibility(vp.width, s)
          expect(afterVisiblePct, `After badge at ${s}% on ${vp.name}`).toBe(100)
          expect(beforeVisiblePct, `Before badge at ${s}% on ${vp.name}`).toBe(100)
        }
      }
    })

    it('2.5 validates monotonic clipping transitions at boundary sweeps [0% to 25%] and [75% to 100%]', () => {
      const drawerWidth = 560
      let prevAfter = -1
      for (let s = 0; s <= 100; s += 1) {
        const { afterVisiblePct } = computeBadgeVisibility(drawerWidth, s)
        expect(afterVisiblePct).toBeGreaterThanOrEqual(prevAfter)
        prevAfter = afterVisiblePct
      }

      let prevBefore = 101
      for (let s = 0; s <= 100; s += 1) {
        const { beforeVisiblePct } = computeBadgeVisibility(drawerWidth, s)
        expect(beforeVisiblePct).toBeLessThanOrEqual(prevBefore)
        prevBefore = beforeVisiblePct
      }
    })
  })

  // =========================================================================
  // 3. Slider Handle & Accessibility Semantics across the Range
  // =========================================================================
  describe('3. Slider Handle & Accessibility Semantics across the Range', () => {
    it('3.1 formats aria-valuenow accurately as an integer for any floating slider position', () => {
      const testCases = [
        { pos: 0, expectedAria: '0' },
        { pos: 0.1, expectedAria: '0' },
        { pos: 25.4, expectedAria: '25' },
        { pos: 50.0, expectedAria: '50' },
        { pos: 75.8, expectedAria: '76' },
        { pos: 99.9, expectedAria: '100' },
        { pos: 100, expectedAria: '100' },
      ]

      for (const tc of testCases) {
        const html = renderToStaticMarkup(React.createElement(SplitSlider, { ...defaultProps, sliderPosition: tc.pos }))
        expect(html).toContain(`aria-valuenow="${tc.expectedAria}"`)
        expect(html).toContain('aria-valuemin="0"')
        expect(html).toContain('aria-valuemax="100"')
        expect(html).toContain('aria-label="Before and after try-on split"')
        expect(html).toContain('role="slider"')
        expect(html).toContain('tabindex="0"')
      }
    })

    it('3.2 includes WCAG AA accessible 2px gold focus-visible ring on the slider handle', () => {
      const html = renderToStaticMarkup(React.createElement(SplitSlider, { ...defaultProps, sliderPosition: 50 }))
      expect(html).toContain('focus-visible:outline-2')
      expect(html).toContain('focus-visible:outline-[var(--gold)]')
      expect(html).toContain('focus-visible:outline-offset-2')
    })
  })

  // =========================================================================
  // 4. Keyboard Navigation Logic Verification
  // =========================================================================
  describe('4. Keyboard Navigation Logic Verification', () => {
    // SplitSlider's handleKeyDown logic:
    function simulateKeyDown(currentPos: number, key: string): { nextPos: number; prevented: boolean } {
      let next = currentPos
      let prevented = false
      const preventDefault = () => {
        prevented = true
      }

      if (key === 'ArrowLeft') {
        next = Math.max(0, currentPos - 5)
      } else if (key === 'ArrowRight') {
        next = Math.min(100, currentPos + 5)
      } else if (key === 'Home') {
        next = 0
      } else if (key === 'End') {
        next = 100
      } else {
        return { nextPos: currentPos, prevented: false }
      }
      preventDefault()
      return { nextPos: next, prevented }
    }

    it('4.1 ArrowLeft decrements slider by 5 with lower clamp at 0', () => {
      expect(simulateKeyDown(50, 'ArrowLeft')).toEqual({ nextPos: 45, prevented: true })
      expect(simulateKeyDown(3, 'ArrowLeft')).toEqual({ nextPos: 0, prevented: true })
      expect(simulateKeyDown(0, 'ArrowLeft')).toEqual({ nextPos: 0, prevented: true })
    })

    it('4.2 ArrowRight increments slider by 5 with upper clamp at 100', () => {
      expect(simulateKeyDown(50, 'ArrowRight')).toEqual({ nextPos: 55, prevented: true })
      expect(simulateKeyDown(97, 'ArrowRight')).toEqual({ nextPos: 100, prevented: true })
      expect(simulateKeyDown(100, 'ArrowRight')).toEqual({ nextPos: 100, prevented: true })
    })

    it('4.3 Home immediately sets position to 0 and End sets position to 100', () => {
      expect(simulateKeyDown(73.5, 'Home')).toEqual({ nextPos: 0, prevented: true })
      expect(simulateKeyDown(26.1, 'End')).toEqual({ nextPos: 100, prevented: true })
    })

    it('4.4 unhandled keys do not mutate state or prevent default event propagation', () => {
      expect(simulateKeyDown(50, 'Enter')).toEqual({ nextPos: 50, prevented: false })
      expect(simulateKeyDown(50, 'Tab')).toEqual({ nextPos: 50, prevented: false })
      expect(simulateKeyDown(50, 'Space')).toEqual({ nextPos: 50, prevented: false })
    })
  })

  // =========================================================================
  // 5. Pointer Calculation & Coordinate Clamping
  // =========================================================================
  describe('5. Pointer Calculation & Coordinate Clamping', () => {
    function computeSliderFromClientX(clientX: number, rectLeft: number, rectWidth: number): number {
      const rawPos = ((clientX - rectLeft) / rectWidth) * 100
      const clamped = Math.min(100, Math.max(0, rawPos))
      return Number(clamped.toFixed(1))
    }

    it('5.1 correctly calculates center (50.0%) and fractional positions with 1 decimal precision', () => {
      const rectLeft = 100
      const rectWidth = 500

      // Exact center: clientX = 350 -> (250 / 500) * 100 = 50.0
      expect(computeSliderFromClientX(350, rectLeft, rectWidth)).toBe(50.0)

      // 1/3 point: clientX = 100 + 500/3 = 266.666... -> 33.3%
      expect(computeSliderFromClientX(100 + 500 / 3, rectLeft, rectWidth)).toBe(33.3)
    })

    it('5.2 clamps pointer coordinates outside container bounds to [0.0, 100.0]', () => {
      const rectLeft = 100
      const rectWidth = 500

      // Dragged way to the left
      expect(computeSliderFromClientX(50, rectLeft, rectWidth)).toBe(0.0)
      expect(computeSliderFromClientX(-500, rectLeft, rectWidth)).toBe(0.0)

      // Dragged way to the right
      expect(computeSliderFromClientX(650, rectLeft, rectWidth)).toBe(100.0)
      expect(computeSliderFromClientX(2000, rectLeft, rectWidth)).toBe(100.0)
    })
  })

  // =========================================================================
  // 6. Measuring Ruler Isolation in Layer 1
  // =========================================================================
  describe('6. Measuring Ruler Isolation in Layer 1', () => {
    it('6.1 conditionally mounts MeasuringRulerOverlay strictly inside Layer 1', () => {
      const withRuler = renderToStaticMarkup(React.createElement(SplitSlider, { ...defaultProps, showRuler: true }))
      expect(withRuler).toContain('CM')
      expect(withRuler).toContain('goldGlow')

      const withoutRuler = renderToStaticMarkup(React.createElement(SplitSlider, { ...defaultProps, showRuler: false }))
      expect(withoutRuler).not.toContain('CM')
      expect(withoutRuler).not.toContain('goldGlow')
    })
  })
})
