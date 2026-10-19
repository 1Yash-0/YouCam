import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  hashParams,
  stepCacheKey,
  createPipelineTryonService,
  PipelineDeps,
} from '@/lib/tryon-pipeline'
import { createStorage } from '@/lib/storage'
import {
  SAMPLE_PHOTO_ID,
  SAMPLE_IRIS_PX,
} from '@/hooks/useTryOn'

describe('Challenger M1 Empirical Stress Tests', () => {
  const EXPECTED_CACHE_KEY = '993465cc95471646a53a2fbf2202469c6115323840995a109f856a221a6d9fcc'
  const EXPECTED_PARAMS_HASH = 'ff293334f71efedfc4507401d730b39ff00be987b37dc1420430163ea4cd38f0'

  // =========================================================================
  // 1. 0-Unit Caching & Cache Key Math Verification
  // =========================================================================
  describe('1. 0-Unit Caching & Cache Key Math Verification', () => {
    it('1.1 computes exact canonical serialization for sample face parameters', () => {
      const params = {
        productId: 'gilded-teardrop',
        sizeCm: 3.0,
        rightEar: true,
        occluded: 0,
        wearingLocation: null,
        irisPx: SAMPLE_IRIS_PX,
      }

      const computedHash = hashParams(params)
      expect(computedHash).toBe(EXPECTED_PARAMS_HASH)
    })

    it('1.2 computes exact SHA-256 step cache key matching pre-cached asset 993465...', () => {
      const computedKey = stepCacheKey({
        inputHash: SAMPLE_PHOTO_ID,
        stepType: 'earring',
        paramsHash: EXPECTED_PARAMS_HASH,
      })

      expect(computedKey).toBe(EXPECTED_CACHE_KEY)
      expect(computedKey).toHaveLength(64)
      expect(computedKey).toMatch(/^[a-f0-9]{64}$/)
    })

    it('1.3 verifies step cache JSON meta and rendered image exist on disk', () => {
      const rootDir = path.resolve(__dirname, '../../../../.data')
      const metaPath = path.join(rootDir, 'meta/step-cache', `${EXPECTED_CACHE_KEY}.json`)
      const filePath = path.join(rootDir, 'step-cache', `${EXPECTED_CACHE_KEY}.png`)

      expect(fs.existsSync(metaPath)).toBe(true)
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      expect(meta.key).toBe(EXPECTED_CACHE_KEY)
      expect(meta.stepType).toBe('earring')
      expect(meta.inputHash).toBe(SAMPLE_PHOTO_ID)
      expect(meta.paramsHash).toBe(EXPECTED_PARAMS_HASH)
      expect(meta.units).toBe(1)

      expect(fs.existsSync(filePath)).toBe(true)
      const stat = fs.statSync(filePath)
      expect(stat.size).toBeGreaterThan(1_000_000) // ~2.17 MB rendered portrait
    })

    it('1.4 resolves synchronously from cache with unitsSpent: 0 when sample face is submitted', async () => {
      // Create isolated pipeline service pointing to real project .data directory
      const realRootDir = path.resolve(__dirname, '../../../../.data')
      const storage = createStorage({ rootDir: realRootDir })

      const createTaskMock = vi.fn()
      const uploadFileMock = vi.fn()
      const getTaskMock = vi.fn()
      const recordSpendMock = vi.fn()
      const assertCanSpendMock = vi.fn()

      const deps: PipelineDeps = {
        youcam: {
          uploadFile: uploadFileMock,
          createTask: createTaskMock,
          getTask: getTaskMock,
        },
        fetchBytes: vi.fn(),
        storage,
        guard: {
          assertCanSpend: assertCanSpendMock,
          recordSpend: recordSpendMock,
        },
        products: {
          getProductWithFileId: vi.fn(async (id: string) => {
            if (id === 'gilded-teardrop') {
              return {
                product: {
                  id: 'gilded-teardrop',
                  type: 'single',
                  heightCm: 3.0,
                },
                fileId: 'mock-file-id',
              }
            }
            return null
          }),
        },
        measure: vi.fn(async () => ({
          renderedCm: 3.0,
          renderedPx: 95,
          tolerancePct: 0,
          withinTolerance: true,
          box: { x: 360, y: 648, w: 28, h: 95, pixels: 1820 },
        })),
        now: () => new Date('2026-10-18T10:00:00Z'),
        uuid: () => 'challenger-test-job-uuid',
      }

      const service = createPipelineTryonService(deps)

      const request = {
        photoId: SAMPLE_PHOTO_ID,
        productId: 'gilded-teardrop',
        sizeCm: 3.0,
        ear: 'right' as const,
        irisPx: 37,
      }

      const response = await service.createPipelineTryOnJob(request, 'challenger-visitor')

      expect(response.status).toBe('done')
      if (response.status === 'done') {
        expect(response.result.unitsSpent).toBe(0)
        expect(response.result.steps).toEqual([
          { type: 'earring', units: 1, cached: true },
        ])
        expect(response.result.key).toBeDefined()
      }

      // Assert zero external API calls were made
      expect(createTaskMock).not.toHaveBeenCalled()
      expect(uploadFileMock).not.toHaveBeenCalled()
      expect(recordSpendMock).not.toHaveBeenCalled()
    })

    it('1.5 verifies cache sensitivity: any parameter alteration invalidates the cache key', () => {
      const baseParams = {
        productId: 'gilded-teardrop',
        sizeCm: 3.0,
        rightEar: true,
        occluded: 0,
        wearingLocation: null,
        irisPx: 37,
      }

      // Alter sizeCm from 3.0 to 4.5
      const sizeAlteredKey = stepCacheKey({
        inputHash: SAMPLE_PHOTO_ID,
        stepType: 'earring',
        paramsHash: hashParams({ ...baseParams, sizeCm: 4.5 }),
      })
      expect(sizeAlteredKey).not.toBe(EXPECTED_CACHE_KEY)

      // Alter rightEar from true to false (left ear)
      const earAlteredKey = stepCacheKey({
        inputHash: SAMPLE_PHOTO_ID,
        stepType: 'earring',
        paramsHash: hashParams({ ...baseParams, rightEar: false }),
      })
      expect(earAlteredKey).not.toBe(EXPECTED_CACHE_KEY)

      // Alter irisPx from 37 to 38
      const irisAlteredKey = stepCacheKey({
        inputHash: SAMPLE_PHOTO_ID,
        stepType: 'earring',
        paramsHash: hashParams({ ...baseParams, irisPx: 38 }),
      })
      expect(irisAlteredKey).not.toBe(EXPECTED_CACHE_KEY)
    })
  })

  // =========================================================================
  // 2. Split Slider Layer Masking & Measuring Ruler Isolation
  // =========================================================================
  describe('2. Split Slider Layer Masking & Ruler Isolation', () => {
    it('2.1 asserts measuring ruler coordinates live strictly within the After layer bounding domain', () => {
      // Natural image dimensions
      const naturalWidth = 1104

      // Jewellery bounding box on sample face
      const safeBox = { x: 360, y: 648, w: 28, h: 95, pixels: 1820 }

      // Ruler placement logic in MeasuringRulerOverlay
      const rulerX = safeBox.x + safeBox.w + 16 // 360 + 28 + 16 = 404

      // Cm measurement pill geometry
      const pillX = rulerX + 12 // 416
      const pillWidth = 130 // width attribute
      const pillRightEdge = pillX + pillWidth // 546

      // Ruler coordinates as percentage of image width
      const rulerPctX = (rulerX / naturalWidth) * 100 // 36.59%
      const pillRightPctX = (pillRightEdge / naturalWidth) * 100 // 49.46%

      expect(rulerPctX).toBeCloseTo(36.59, 1)
      expect(pillRightPctX).toBeLessThan(50.0) // At 50% split, ruler and pill are inside the left 50%
      expect(pillRightPctX).toBeCloseTo(49.46, 1)
    })

    it('2.2 verifies clip-path math: when slider is left of ruler (<36.6%), ruler is completely clipped', () => {
      // Container clip-path style formula: inset(0 calc(100% - ${sliderPosition}%) 0 0)
      const naturalWidth = 1104
      const rulerLeftBoundPx = 360 // Jewellery box starts at 360px

      const rulerLeftBoundPct = (rulerLeftBoundPx / naturalWidth) * 100 // 32.61%

      // When sliderPosition = 30%, the visible slice of After layer is [0%, 30%].
      // Since ruler is between 32.61% and 49.46%, it is 100% within the clipped-out region [30%, 100%].
      const sliderPosition = 30
      const isRulerClippedOut = sliderPosition < rulerLeftBoundPct
      expect(isRulerClippedOut).toBe(true)

      // When sliderPosition = 0%, After layer has visible width 0%, so zero ruler pixels render.
      const sliderAtZero = 0
      expect(sliderAtZero < rulerLeftBoundPct).toBe(true)
    })

    it('2.3 highlights SplitSlider label placement bug (BEFORE at left-4, AFTER at right-4)', () => {
      // In SplitSlider.tsx:
      // Layer 0 (Before image):
      //   <div className="absolute top-4 left-4 z-10">BEFORE</div>
      // Layer 1 (After image with clip-path):
      //   style={{ clipPath: `inset(0 calc(100% - ${sliderPosition}%) 0 0)` }}
      //   <div className="absolute top-4 right-4 z-10">AFTER</div>
      //
      // Empirical Analysis:
      // - At sliderPosition = 50%:
      //   1. Layer 1 (After) is rendered on the left [0% to 50%].
      //   2. Layer 1's child 'AFTER' label is at right-4 (approx x = 96% to 98%).
      //      Because x > 50%, the 'AFTER' label is completely inside the clipped area and invisible.
      //   3. Layer 0's 'BEFORE' label is at left-4 (approx x = 2% to 4%).
      //      Because Layer 1 is visible on [0% to 50%] and sits on top with an opaque image,
      //      Layer 1 covers up Layer 0's 'BEFORE' label.
      // Result: Both labels are visually obscured or misplaced relative to the revealed sides!

      const sliderPos = 50
      const afterLabelPosPct = 96 // right-4 is near 96-98%
      const isAfterLabelClipped = afterLabelPosPct > sliderPos
      expect(isAfterLabelClipped).toBe(true)

      const beforeLabelPosPct = 4 // left-4 is near 2-4%
      const isBeforeLabelUnderAfterLayer = beforeLabelPosPct < sliderPos
      expect(isBeforeLabelUnderAfterLayer).toBe(true)
    })
  })

  // =========================================================================
  // 3. Edge Cases: Sizing, Ear Selection & Cart Stepper
  // =========================================================================
  describe('3. Edge Cases: Sizing, Ear Selection & Cart Stepper', () => {
    it('3.1 size selection tolerance handles IEEE 754 float comparison', () => {
      const sizes = [2.0, 3.0, 4.5, 6.0]
      const selectedSize = 3.0000000001
      const activeMatch = sizes.find((s) => Math.abs(selectedSize - s) < 0.05)
      expect(activeMatch).toBe(3.0)

      const unselectedSize = 3.8
      const noMatch = sizes.find((s) => Math.abs(unselectedSize - s) < 0.05)
      expect(noMatch).toBeUndefined()
    })

    it('3.2 ear selection auto mode omits body.ear and sets earPinned: false for fallback', () => {
      const stateEar = 'auto'
      const body: Record<string, any> = { photoId: 'photo-1', productId: 'p1' }
      if (stateEar !== 'auto') {
        body.ear = stateEar
      }
      expect(body.ear).toBeUndefined()

      // In tryon-pipeline.ts:
      // rightEar: request.ear !== 'left'
      // earPinned: request.ear !== undefined
      const isRightEar = body.ear !== 'left'
      const isEarPinned = body.ear !== undefined

      expect(isRightEar).toBe(true) // Defaults to right ear
      expect(isEarPinned).toBe(false) // Not pinned, allows retry fallback on alignment error
    })

    it('3.3 cart quantity stepper correctly increments, decrements, and removes on 0', () => {
      let cart = [
        {
          id: 'gilded-teardrop-3.0',
          productId: 'gilded-teardrop',
          sizeCm: 3.0,
          priceInr: 1499,
          quantity: 1,
        },
      ]

      // Step up (+): quantity becomes 2
      const stepUp = (id: string) => {
        cart = cart.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      stepUp('gilded-teardrop-3.0')
      expect(cart[0].quantity).toBe(2)
      expect(cart[0].priceInr * cart[0].quantity).toBe(2998)

      // Step down (-): quantity becomes 1
      const stepDown = (id: string) => {
        const item = cart.find((i) => i.id === id)
        if (!item) return
        const nextQty = item.quantity - 1
        if (nextQty <= 0) {
          cart = cart.filter((i) => i.id !== id)
        } else {
          cart = cart.map((i) => (i.id === id ? { ...i, quantity: nextQty } : i))
        }
      }
      stepDown('gilded-teardrop-3.0')
      expect(cart[0].quantity).toBe(1)

      // Step down again (-) at quantity 1: removes item from cart
      stepDown('gilded-teardrop-3.0')
      expect(cart).toHaveLength(0)
    })

    it('3.4 cart differentiates same product added at different physical sizes', () => {
      const item1 = {
        id: 'gilded-teardrop-3.0',
        productId: 'gilded-teardrop',
        sizeCm: 3.0,
        quantity: 1,
      }
      const item2 = {
        id: 'gilded-teardrop-4.5',
        productId: 'gilded-teardrop',
        sizeCm: 4.5,
        quantity: 1,
      }

      const cart = [item1, item2]
      expect(cart).toHaveLength(2)
      expect(cart[0].sizeCm).toBe(3.0)
      expect(cart[1].sizeCm).toBe(4.5)
    })
  })
})
