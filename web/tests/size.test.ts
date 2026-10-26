import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { diffBox, pxPerCm, measure, correctedScale } from '@/lib/size'

describe('Size Engine', () => {
  describe('pxPerCm', () => {
    it('should calculate pixels per cm correctly', () => {
      expect(pxPerCm(35, 11.7)).toBeCloseTo(29.91, 2)
      expect(pxPerCm(50, 11.7)).toBeCloseTo(42.74, 2)
      expect(pxPerCm(23.4, 11.7)).toBe(20) // 23.4 / (11.7/10) = 20
    })
  })

  describe('correctedScale', () => {
    it('should calculate corrected scale', () => {
      // Requested 6cm, rendered 5.8cm -> correction = 6 * 6 / 5.8 = 6.206...
      expect(correctedScale(6, 5.8)).toBeCloseTo(6.2069, 3)
      
      // Within clamping range
      expect(correctedScale(3, 2)).toBeCloseTo(4.5, 1) // 3 * 3 / 2 = 4.5
      expect(correctedScale(3, 6)).toBeCloseTo(1.5, 1) // 3 * 3 / 6 = 1.5
      
      // Clamped to 0.5x - 2x range
      expect(correctedScale(3, 1)).toBeCloseTo(6, 1) // Would be 9, clamped to 6 (2x)
      expect(correctedScale(3, 12)).toBeCloseTo(1.5, 1) // Would be 0.75, clamped to 1.5 (0.5x)
    })
  })

  describe('diffBox', () => {
    it('should return null for identical images', async () => {
      // Create a simple test image
      const testImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).png().toBuffer()

      const result = await diffBox(testImage, testImage)
      expect(result).toBeNull()
    })

    it('should detect a simple rectangle', async () => {
      // Create a white background image
      const before = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).png().toBuffer()

      // Create an "after" image with a black rectangle (high contrast)
      const after = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([{
          input: Buffer.from([...Array(20 * 100 * 3)].map(() => 0)), // Black rectangle
          raw: { width: 20, height: 100, channels: 3 },
          top: 50,
          left: 90,
        }])
        .png()
        .toBuffer()

      const result = await diffBox(before, after, 10) // Lower threshold for test
      expect(result).not.toBeNull()
      expect(result!.w).toBe(20)
      expect(result!.h).toBe(100)
      expect(result!.x).toBe(90)
      expect(result!.y).toBe(50)
      expect(result!.pixels).toBe(20 * 100) // All pixels in the rectangle
    })

    it('should resize after image to match before dimensions', async () => {
      const before = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).png().toBuffer()

      const after = await sharp({
        create: {
          width: 200, // Different size
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([{
          input: Buffer.from([...Array(10 * 50 * 3)].map(() => 0)), // Black rectangle
          raw: { width: 10, height: 50, channels: 3 },
          top: 25,
          left: 45,
        }])
        .png()
        .toBuffer()

      const result = await diffBox(before, after, 10)
      expect(result!.resized).toBe(true)
      // After resizing, the rectangle should be at proportional position
      expect(result!.w).toBe(5) // 10 * (100/200) = 5
      expect(result!.h).toBe(25) // 50 * (100/200) = 25
    })

    it('should ignore small noise (< 30px)', async () => {
      const before = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).png().toBuffer()

      // Create an image with a few scattered changed pixels (less than 30)
      const afterBuffer = await sharp(before)
        .raw()
        .toBuffer({ resolveWithObject: true })
      
      // Modify a few pixels
      const data = afterBuffer.data
      for (let i = 0; i < 20 * 3; i += 3) {
        data[i] = 0 // Change red channel
      }
      
      const after = await sharp(data, {
        raw: { width: 100, height: 100, channels: 3 },
      }).png().toBuffer()

      const result = await diffBox(before, after)
      expect(result).toBeNull() // Should be ignored because < 30px
    })

    it('should select largest component when multiple exist', async () => {
      const before = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).png().toBuffer()

      // Create two rectangles: 20x30 and 40x50
      const after = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([
          {
            input: Buffer.from([...Array(20 * 30 * 3)].map(() => 0)), // Black rectangle
            raw: { width: 20, height: 30, channels: 3 },
            top: 10,
            left: 10,
          },
          {
            input: Buffer.from([...Array(40 * 50 * 3)].map(() => 0)), // Black rectangle
            raw: { width: 40, height: 50, channels: 3 },
            top: 100,
            left: 100,
          },
        ])
        .png()
        .toBuffer()

      const result = await diffBox(before, after, 10)
      expect(result!.w).toBe(40) // Largest component
      expect(result!.h).toBe(50)
      expect(result!.pixels).toBe(40 * 50)
    })
  })

  describe('measure', () => {
    it('should measure with iris provided', async () => {
      // Create test images
      const before = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).png().toBuffer()

      const after = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([{
          input: Buffer.from([...Array(20 * 100 * 3)].map(() => 0)), // Black rectangle
          raw: { width: 20, height: 100, channels: 3 },
          top: 0,
          left: 40,
        }])
        .png()
        .toBuffer()

      const measurement = await measure({
        before,
        after,
        requestedCm: 3.0,
        irisPx: 35, // 35px iris
      })

      expect(measurement.renderedPx).toBe(100)
      expect(measurement.renderedCm).toBeCloseTo(100 / (35 / (11.7/10)), 2)
      expect(measurement.errorPct).toBeDefined()
      expect(measurement.withinTolerance).toBeDefined()
      expect(measurement.tolerancePct).toBe(10)
    })

    it('should measure without iris', async () => {
      const before = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).png().toBuffer()

      const after = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([{
          input: Buffer.from([...Array(20 * 100 * 3)].map(() => 0)), // Black rectangle
          raw: { width: 20, height: 100, channels: 3 },
          top: 0,
          left: 40,
        }])
        .png()
        .toBuffer()

      const measurement = await measure({
        before,
        after,
        requestedCm: 3.0,
        // No irisPx provided
      })

      expect(measurement.renderedPx).toBe(100)
      expect(measurement.renderedCm).toBeUndefined()
      expect(measurement.errorPct).toBeUndefined()
      expect(measurement.withinTolerance).toBeUndefined()
      expect(measurement.note).toBe('iris not provided')
    })

    it('should throw when no changes detected', async () => {
      const before = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).png().toBuffer()

      const after = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).png().toBuffer()

      await expect(
        measure({
          before,
          after,
          requestedCm: 3.0,
          irisPx: 35,
        })
      ).rejects.toThrow('No significant changes detected')
    })
  })
})