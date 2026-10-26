export type HeroSizeStage = 0 | 1 | 2

export function heroSizeStage(progress: number): HeroSizeStage {
  return progress >= 0.65 ? 2 : progress >= 0.3 ? 1 : 0
}

export function heroFrameIndex(frameCount: number, stage: HeroSizeStage) {
  return stage === 2 ? frameCount - 1 : Math.min(stage, frameCount - 1)
}

export function heroScrollDistance(viewportHeight: number) {
  return Math.min(600, Math.max(400, viewportHeight * 0.6))
}

export interface HeroLayoutInput {
  availableWidth: number
  viewportHeight: number
  headerHeight: number
  galleryChrome: number
  cardChrome: number
  columns: 2 | 4
  gap: number
  reduced: boolean
}

/** Fit whole photographs from measured chrome, rather than cropping them to a guessed height. */
export function heroLayout(input: HeroLayoutInput) {
  const { availableWidth, viewportHeight, headerHeight, galleryChrome, cardChrome, columns, gap, reduced } = input
  const rows = 4 / columns
  const photoHeight = (viewportHeight - headerHeight - galleryChrome - (rows - 1) * gap - 12) / rows - cardChrome
  const fittedWidth = Math.min(availableWidth, Math.max(0, photoHeight) * 5 / 8 * columns + (columns - 1) * gap)
  const readable = (fittedWidth - (columns - 1) * gap) / columns >= (columns === 4 ? 208 : 116)
  const pin = !reduced && viewportHeight >= 600 && readable
  return { width: pin ? fittedWidth : availableWidth, pin }
}
