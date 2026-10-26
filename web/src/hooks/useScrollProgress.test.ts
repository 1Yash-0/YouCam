import { describe, it, expect } from 'vitest'
import { useScrollProgress, remap, easeOutCubic } from './useScrollProgress'

describe('useScrollProgress helpers', () => {
  describe('remap', () => {
    it('normalizes to [0, 1] by default', () => {
      expect(remap(0, 0, 100)).toBe(0)
      expect(remap(50, 0, 100)).toBe(0.5)
      expect(remap(100, 0, 100)).toBe(1)
    })

    it('clamps values below inMin and above inMax', () => {
      expect(remap(-10, 0, 100)).toBe(0)
      expect(remap(150, 0, 100)).toBe(1)
    })

    it('maps to custom [outMin, outMax]', () => {
      expect(remap(50, 0, 100, 2, 6)).toBe(4)
      expect(remap(0, 0, 100, 2, 6)).toBe(2)
      expect(remap(100, 0, 100, 2, 6)).toBe(6)
    })

    it('handles inverted output ranges [outMin > outMax]', () => {
      expect(remap(0, 0, 1, 1, 0)).toBe(1)
      expect(remap(1, 0, 1, 1, 0)).toBe(0)
      expect(remap(0.25, 0, 1, 1, 0)).toBe(0.75)
    })

    it('handles inverted input ranges [inMin > inMax]', () => {
      expect(remap(100, 100, 0, 0, 1)).toBe(0)
      expect(remap(0, 100, 0, 0, 1)).toBe(1)
      expect(remap(50, 100, 0, 0, 1)).toBe(0.5)
    })
  })

  describe('easeOutCubic', () => {
    it('eases at endpoints', () => {
      expect(easeOutCubic(0)).toBe(0)
      expect(easeOutCubic(1)).toBe(1)
    })

    it('clamps outside [0, 1]', () => {
      expect(easeOutCubic(-0.5)).toBe(0)
      expect(easeOutCubic(1.5)).toBe(1)
    })

    it('produces cubic ease-out progression', () => {
      // 1 - (1 - 0.5)^3 = 1 - 0.125 = 0.875
      expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 4)
    })
  })

  describe('useScrollProgress static methods', () => {
    it('exposes remap and easeOutCubic as static functions on useScrollProgress', () => {
      expect(useScrollProgress.remap).toBe(remap)
      expect(useScrollProgress.easeOutCubic).toBe(easeOutCubic)
    })
  })
})
