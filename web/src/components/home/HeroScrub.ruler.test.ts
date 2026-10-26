import { describe, expect, it } from 'vitest'
import {
  HERO_FRAMES,
  HERO_IMAGE_CROP,
  HERO_MOBILE_CAMERA_BOTTOM_MARGIN,
  getHeroSizeForProgress,
  getHeroSizePositionForProgress,
  getHeroStopIndexForProgress,
  getHeroCrossfadeOpacity,
  getHeroWipeY,
  getHeroBlendRegion,
  getHeroStage2CameraScale,
  mapHeroBoxToScreenRect,
  mapHeroImagePointToScreen,
} from './HeroScrub'

const VIEWPORTS = [
  { width: 1440, height: 900, isNarrowScreen: false },
  { width: 390, height: 844, isNarrowScreen: true },
] as const

// The camera scale is intentionally representative of the stage-2 camera, not a spring value.
const CAMERA_SCALE = 1.4

describe('Hero ruler geometry', () => {
  it.each(VIEWPORTS)('maps every authored box edge exactly at $width x $height', (viewport) => {
    const stageSize = { width: viewport.width, height: viewport.height }

    HERO_FRAMES.forEach((frame) => {
      const rect = mapHeroBoxToScreenRect(frame, stageSize, CAMERA_SCALE, viewport.isNarrowScreen ? HERO_FRAMES[3] : frame, viewport.isNarrowScreen)
      const expectedTop = mapHeroImagePointToScreen(
        { x: frame.box.x, y: frame.box.y },
        stageSize,
        CAMERA_SCALE,
        viewport.isNarrowScreen ? HERO_FRAMES[3] : frame,
        viewport.isNarrowScreen,
      )
      const expectedBottom = mapHeroImagePointToScreen(
        { x: frame.box.x + frame.box.w, y: frame.box.y + frame.box.h },
        stageSize,
        CAMERA_SCALE,
        viewport.isNarrowScreen ? HERO_FRAMES[3] : frame,
        viewport.isNarrowScreen,
      )

      expect(rect.y).toBe(expectedTop.y)
      expect(rect.bottom).toBe(expectedBottom.y)
      expect(rect.height).toBe(expectedBottom.y - expectedTop.y)
      expect(rect.x).toBe(expectedTop.x)
      expect(rect.right).toBe(expectedBottom.x)
    })
  })

  it('keeps the 6 cm box fully visible with the mobile photo margin', () => {
    const stageSize = { width: 390, height: 200 }
    const size6 = HERO_FRAMES[3]
    const rect = mapHeroBoxToScreenRect(size6, stageSize, 1.06, size6, true)

    expect(rect.bottom).toBeLessThanOrEqual(stageSize.height * (1 - HERO_MOBILE_CAMERA_BOTTOM_MARGIN))
    expect(rect.bottom).toBeGreaterThan(rect.height)
    expect(rect.y).toBeGreaterThan(0)
  })

  it('maps the fixed 900 x 1000 natural crop to the stage at cover scale', () => {
    const stageSize = { width: HERO_IMAGE_CROP.width, height: HERO_IMAGE_CROP.height }
    const cropTopLeft = mapHeroImagePointToScreen(
      { x: HERO_IMAGE_CROP.x, y: HERO_IMAGE_CROP.y },
      stageSize,
      1,
      HERO_FRAMES[3],
    )
    const cropBottomRight = mapHeroImagePointToScreen(
      { x: HERO_IMAGE_CROP.x + HERO_IMAGE_CROP.width, y: HERO_IMAGE_CROP.y + HERO_IMAGE_CROP.height },
      stageSize,
      1,
      HERO_FRAMES[3],
    )

    expect(cropTopLeft.x).toBeCloseTo(0, 6)
    expect(cropTopLeft.y).toBeCloseTo(0, 6)
    expect(cropBottomRight.x).toBeCloseTo(stageSize.width, 6)
    expect(cropBottomRight.y).toBeCloseTo(stageSize.height, 6)
  })

  it('crossfades only through the middle 40% with smoothstep progress for the wipe', () => {
    expect(getHeroCrossfadeOpacity(0)).toBe(0)
    expect(getHeroCrossfadeOpacity(0.3)).toBe(0)
    expect(getHeroCrossfadeOpacity(0.5)).toBeCloseTo(0.5, 6)
    expect(getHeroCrossfadeOpacity(0.7)).toBe(1)
    expect(getHeroCrossfadeOpacity(1)).toBe(1)
  })

  it('moves the feathered wipe from size-2 top to size-6 bottom plus 24 natural pixels', () => {
    const startY = HERO_FRAMES[0].box.y
    const endY = HERO_FRAMES[3].box.y + HERO_FRAMES[3].box.h + 24
    expect(getHeroWipeY(0)).toBe(startY)
    expect(getHeroWipeY(0.3)).toBe(startY)
    expect(getHeroWipeY(0.5)).toBeCloseTo((startY + endY) / 2, 6)
    expect(getHeroWipeY(0.7)).toBe(endY)
    expect(getHeroWipeY(1)).toBe(endY)
  })

  it('uses one capped stage-2 camera with a continuous 1.00 to 1.06 push-in', () => {
    expect(getHeroStage2CameraScale(0.30)).toBeCloseTo(1.00, 6)
    expect(getHeroStage2CameraScale(0.55)).toBeGreaterThan(1)
    expect(getHeroStage2CameraScale(0.80)).toBeCloseTo(1.06, 6)
    expect(getHeroStage2CameraScale(1)).toBeCloseTo(1.06, 6)
  })

  it('pads the adjacent earring union by 24 natural pixels for the feathered mask', () => {
    const region = getHeroBlendRegion(HERO_FRAMES[0], HERO_FRAMES[1])
    expect(region.x).toBe(333)
    expect(region.y).toBe(632)
    expect(region.right).toBe(423)
    expect(region.bottom).toBe(782)
  })

  it('scrubs continuously through authored stops while labels stay honest', () => {
    expect(getHeroSizePositionForProgress(0.30)).toBe(0)
    expect(getHeroSizePositionForProgress(0.40)).toBeGreaterThan(0)
    expect(getHeroSizePositionForProgress(0.4667)).toBe(1)
    expect(getHeroSizePositionForProgress(0.55)).toBeGreaterThan(1)
    expect(getHeroSizePositionForProgress(0.80)).toBe(3)
    expect(getHeroSizeForProgress(0.30)).toBe(2)
    expect(getHeroSizeForProgress(0.80)).toBe(6)
    expect(getHeroStopIndexForProgress(0.40)).toBe(1)
    expect(getHeroStopIndexForProgress(0.55)).toBe(2)
    expect(getHeroStopIndexForProgress(0.72)).toBe(3)
  })
})

