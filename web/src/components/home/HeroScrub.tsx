'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMotionValueEvent, useScroll } from 'motion/react'

export interface HeroFrame {
  sizeCm: number
  imageUrl: string
  box: { x: number; y: number; w: number; h: number }
  pixels?: number
}

import size2 from '../../../public/hero/size-2.json'
import size3 from '../../../public/hero/size-3.json'
import size45 from '../../../public/hero/size-4_5.json'
import size6 from '../../../public/hero/size-6.json'

export const HERO_FRAMES: HeroFrame[] = [size2, size3, size45, size6]

/** The four stops live inside the size-scrub portion of the pinned scene. */
export const HERO_STOP_PROGRESS = [0.30, 0.4667, 0.6333, 0.80] as const
export const HERO_CAPTIONS = [
  'Sits at the lobe.',
  'Halfway to the jaw.',
  'Near the jawline.',
  'Past the jaw.',
] as const

export const HERO_REDUCED_MOTION_GRID = HERO_FRAMES.map((frame) => ({
  imageUrl: frame.imageUrl,
  label: `${formatTrackSize(frame.sizeCm)} cm`,
}))

export const HERO_IMAGE_WIDTH = 1104
export const HERO_IMAGE_HEIGHT = 1472
export const HERO_IMAGE_CROP = { x: 150, y: 300, width: 900, height: 1000 } as const
export const HERO_MOBILE_PHOTO_FRAME_FRACTION = 0.60
export const HERO_MOBILE_CAMERA_BOTTOM_MARGIN = 0.08
const RULER_GAP_PX = 8
const PX_PER_CM = 41 / 1.17
const PX_PER_MM = PX_PER_CM / 10
const HERO_TRANSITION_START = 0.16
const HERO_TEXT_EXIT_END = 0.22
const HERO_MORPH_START = 0.22
const HERO_MORPH_END = 0.32
const HERO_CONTROLS_START = 0.32
const HERO_CONTROLS_END = 0.34
const HERO_STAGE_3_START = 0.80
const HERO_STOP_HOLD = 0.02
const HERO_STAGE_2_CAMERA_START = 1.00
const HERO_STAGE_2_CAMERA_END = 1.06
const HERO_STAGE_2_START_PROGRESS = HERO_STOP_PROGRESS[0]
const HERO_BLEND_WINDOW_START = 0.30
const HERO_BLEND_WINDOW_END = 0.70
const HERO_BLEND_FEATHER_NATURAL_PX = 24
const HERO_WIPE_FEATHER_SCREEN_PX = 20
const HERO_WIPE_END_MARGIN_NATURAL_PX = 24
const HERO_FRAME_SIZES = HERO_FRAMES.map((frame) => frame.sizeCm)

export interface HeroStageSize {
  width: number
  height: number
}

export interface HeroScreenPoint {
  x: number
  y: number
}

export interface HeroScreenRect extends HeroScreenPoint {
  width: number
  height: number
  right: number
  bottom: number
}

interface HeroCameraTransform {
  coverScale: number
  planeLeft: number
  planeTop: number
  originX: number
  originY: number
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1)
}

function smoothstep01(value: number) {
  const amount = clamp01(value)
  return amount * amount * (3 - 2 * amount)
}

function interpolate(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function getHeroCameraTransform(
  stageSize: HeroStageSize,
  cameraFrame: HeroFrame,
  _isNarrowScreen: boolean,
): HeroCameraTransform {
  // The camera is an object-fit: cover of the authored 900 x 1000 natural crop.
  // Every frame uses the same plane so only the earring render changes between wipes.
  const coverScale = Math.max(stageSize.width / HERO_IMAGE_CROP.width, stageSize.height / HERO_IMAGE_CROP.height)
  const cropWidth = HERO_IMAGE_CROP.width * coverScale
  const cropHeight = HERO_IMAGE_CROP.height * coverScale
  const planeLeft = (stageSize.width - cropWidth) / 2 - HERO_IMAGE_CROP.x * coverScale
  const planeTop = (stageSize.height - cropHeight) / 2 - HERO_IMAGE_CROP.y * coverScale
  const originX = (cameraFrame.box.x + cameraFrame.box.w / 2) * coverScale
  const originY = (cameraFrame.box.y + cameraFrame.box.h / 2) * coverScale

  return {
    coverScale,
    planeLeft,
    planeTop,
    originX,
    originY,
  }
}

/** Maps a natural image coordinate through the exact camera transform used by the hero image. */
export function mapHeroImagePointToScreen(
  point: HeroScreenPoint,
  stageSize: HeroStageSize,
  cameraScale: number,
  cameraFrame: HeroFrame,
  isNarrowScreen = false,
): HeroScreenPoint {
  const camera = getHeroCameraTransform(stageSize, cameraFrame, isNarrowScreen)
  return {
    x: camera.planeLeft + camera.originX + (point.x * camera.coverScale - camera.originX) * cameraScale,
    y: camera.planeTop + camera.originY + (point.y * camera.coverScale - camera.originY) * cameraScale,
  }
}

/** Returns the earring box in face-stage screen coordinates for both the line and its label. */
export function mapHeroBoxToScreenRect(
  frame: HeroFrame,
  stageSize: HeroStageSize,
  cameraScale: number,
  cameraFrame: HeroFrame = frame,
  isNarrowScreen = false,
): HeroScreenRect {
  const topLeft = mapHeroImagePointToScreen(frame.box, stageSize, cameraScale, cameraFrame, isNarrowScreen)
  const bottomRight = mapHeroImagePointToScreen(
    { x: frame.box.x + frame.box.w, y: frame.box.y + frame.box.h },
    stageSize,
    cameraScale,
    cameraFrame,
    isNarrowScreen,
  )

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
    right: bottomRight.x,
    bottom: bottomRight.y,
  }
}

export function getNearestHeroFrameIndex(sizeCm: number): number {
  return HERO_FRAME_SIZES.reduce(
    (nearestIndex, frameSize, index) =>
      Math.abs(frameSize - sizeCm) < Math.abs(HERO_FRAME_SIZES[nearestIndex] - sizeCm)
        ? index
        : nearestIndex,
    0,
  )
}

/** Returns the continuous position through the four authored size stops. */
export function getHeroSizePositionForProgress(progress: number): number {
  const p = clamp01(progress)
  const stops = HERO_STOP_PROGRESS

  if (p <= stops[0]) return 0
  if (p >= stops[stops.length - 1]) return stops.length - 1

  for (let index = 1; index < stops.length; index += 1) {
    const previousStop = stops[index - 1]
    const stop = stops[index]
    if (p <= stop) {
      const transitionStart = previousStop + HERO_STOP_HOLD
      const transitionEnd = stop - HERO_STOP_HOLD
      if (p <= transitionStart) return index - 1
      if (p >= transitionEnd) return index
      return index - 1 + (p - transitionStart) / (transitionEnd - transitionStart)
    }
  }

  return stops.length - 1
}

/** The interpolated physical size; labels intentionally remain discrete. */
export function getHeroSizeForProgress(progress: number): number {
  const position = getHeroSizePositionForProgress(progress)
  const lowerIndex = Math.min(Math.floor(position), HERO_FRAME_SIZES.length - 2)
  const fraction = position - lowerIndex
  return interpolate(HERO_FRAME_SIZES[lowerIndex], HERO_FRAME_SIZES[lowerIndex + 1], fraction)
}

export function getHeroStopIndexForProgress(progress: number): number {
  return Math.min(HERO_FRAME_SIZES.length - 1, Math.max(0, Math.round(getHeroSizePositionForProgress(progress))))
}


export function getReducedMotionGridItems() {
  return HERO_REDUCED_MOTION_GRID
}

function formatSize(sizeCm: number) {
  return sizeCm.toFixed(1)
}

function formatTrackSize(sizeCm: number) {
  return Number.isInteger(sizeCm) ? sizeCm.toFixed(0) : sizeCm.toFixed(1)
}

function getHeroSizeFrameIndex(position: number) {
  return Math.min(HERO_FRAMES.length - 1, Math.max(0, Math.floor(position)))
}

/**
 * Scrubs the incoming frame only through the middle 40% of an authored interval.
 * The stop edges therefore remain hard frame states while the middle is smooth.
 */
export function getHeroCrossfadeOpacity(sizeFraction: number) {
  const fraction = clamp01(sizeFraction)
  if (fraction <= HERO_BLEND_WINDOW_START) return 0
  if (fraction >= HERO_BLEND_WINDOW_END) return 1
  const t = (fraction - HERO_BLEND_WINDOW_START) / (HERO_BLEND_WINDOW_END - HERO_BLEND_WINDOW_START)
  return t * t * (3 - 2 * t)
}

export function getHeroBlendRegion(frame: HeroFrame, incomingFrame: HeroFrame): HeroScreenRect {
  const left = Math.max(0, Math.min(frame.box.x, incomingFrame.box.x) - HERO_BLEND_FEATHER_NATURAL_PX)
  const top = Math.max(0, Math.min(frame.box.y, incomingFrame.box.y) - HERO_BLEND_FEATHER_NATURAL_PX)
  const right = Math.min(
    HERO_IMAGE_WIDTH,
    Math.max(frame.box.x + frame.box.w, incomingFrame.box.x + incomingFrame.box.w) + HERO_BLEND_FEATHER_NATURAL_PX,
  )
  const bottom = Math.min(
    HERO_IMAGE_HEIGHT,
    Math.max(frame.box.y + frame.box.h, incomingFrame.box.y + incomingFrame.box.h) + HERO_BLEND_FEATHER_NATURAL_PX,
  )
  return { x: left, y: top, width: right - left, height: bottom - top, right, bottom }
}

export function getHeroStage2CameraScale(progress: number) {
  const pushProgress = clamp01((clamp01(progress) - HERO_STAGE_2_START_PROGRESS) / (HERO_STAGE_3_START - HERO_STAGE_2_START_PROGRESS))
  return interpolate(HERO_STAGE_2_CAMERA_START, HERO_STAGE_2_CAMERA_END, pushProgress)
}

export function getHeroWipeY(sizeFraction: number) {
  const fraction = getHeroCrossfadeOpacity(sizeFraction)
  const startY = HERO_FRAMES[0].box.y
  const endY = HERO_FRAMES[HERO_FRAMES.length - 1].box.y + HERO_FRAMES[HERO_FRAMES.length - 1].box.h + HERO_WIPE_END_MARGIN_NATURAL_PX
  return interpolate(startY, endY, fraction)
}

function getIncomingWipeMaskStyle(
  wipeY: number | null,
  coverScale: number,
  cameraScale: number,
  blendOpacity: number,
): React.CSSProperties {
  if (wipeY === null || blendOpacity <= 0 || blendOpacity >= 1) return {}
  // The image plane is transformed by cameraScale, so compensate the authored
  // screen-space feather in the untransformed mask coordinates.
  const maskY = wipeY * coverScale
  const feather = HERO_WIPE_FEATHER_SCREEN_PX / Math.max(cameraScale, 0.0001)
  const maskImage = `linear-gradient(to bottom, #000 0, #000 calc(${maskY}px - ${feather}px), transparent calc(${maskY}px + ${feather}px))`
  return {
    maskImage,
    WebkitMaskImage: maskImage,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
  }
}

function renderPreloadLinks() {
  return HERO_FRAMES.map((frame) => (
    <link key={`preload-${frame.imageUrl}`} rel="preload" as="image" href={frame.imageUrl} type="image/webp" />
  ))
}

function MeasuredFace({
  frame,
  incomingFrame,
  blendOpacity,
  blendRegion,
  wipeY,
  cameraScale,
  coverScale,
  rulerCameraScale,
  planeStyle,
  transformOrigin,
  rulerFrame,
  rulerLabelFrame,
  rulerRect,
  rulerGapNatural,
  showRuler,
}: {
  frame: HeroFrame
  incomingFrame: HeroFrame | null
  blendOpacity: number
  blendRegion: HeroScreenRect | null
  wipeY: number | null
  cameraScale: number
  coverScale: number
  rulerCameraScale: number
  planeStyle: React.CSSProperties
  transformOrigin: string
  rulerFrame: HeroFrame
  rulerLabelFrame: HeroFrame
  rulerRect: HeroScreenRect
  rulerGapNatural: number
  showRuler: boolean
}) {
  const rulerEnd = rulerFrame.box.y + rulerFrame.box.h
  const tickCount = Math.ceil(rulerFrame.box.h / PX_PER_MM)
  const labelStyle: React.CSSProperties = {
    left: rulerRect.right + RULER_GAP_PX,
    top: rulerRect.y - 28,
    opacity: showRuler ? 1 : 0,
    visibility: showRuler ? 'visible' : 'hidden',
  }

  return (
    <>
      <div
        className="absolute"
        data-testid="hero-photo-stack"
        data-hero-camera-scale={cameraScale}
        data-hero-effective-scale={coverScale * cameraScale}
        style={{
          ...planeStyle,
          transform: `scale(${cameraScale})`,
          transformOrigin,
          willChange: 'transform',
        }}
      >
        {/* Adjacent renders crossfade only over the earring union; the face remains intact. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-testid="hero-photo-image"
          data-hero-frame-opacity="1"
          src={frame.imageUrl}
          alt={`Gilded Teardrop at ${formatSize(frame.sizeCm)} cm`}
          className="absolute inset-0 h-full w-full select-none"
          draggable={false}
        />
        {incomingFrame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            data-testid="hero-incoming-image"
            data-hero-incoming-opacity={blendOpacity}
            data-hero-blend-region={blendRegion ? `${blendRegion.x},${blendRegion.y},${blendRegion.width},${blendRegion.height}` : undefined}
            data-hero-wipe-y={wipeY ?? undefined}
            src={incomingFrame.imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full select-none"
            style={{ opacity: blendOpacity <= 0 ? 0 : 1, ...getIncomingWipeMaskStyle(wipeY, coverScale, cameraScale, blendOpacity) }}
            draggable={false}
          />
        ) : null}
        </div>
      <div
        className="pointer-events-none absolute"
        data-testid="hero-ruler-stack"
        style={{
          ...planeStyle,
          transform: `scale(${rulerCameraScale})`,
          transformOrigin,
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          data-reference-size="2.0 CM"
          viewBox={`0 0 ${HERO_IMAGE_WIDTH} ${HERO_IMAGE_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ opacity: showRuler ? 1 : 0, visibility: showRuler ? 'visible' : 'hidden' }}
        >
          <g id="heroGoldGlow" transform={`translate(${rulerFrame.box.x + rulerFrame.box.w + rulerGapNatural} 0)`}>
            <line
              data-testid="hero-ruler-line"
              data-ruler-frame={rulerLabelFrame.sizeCm}
              data-ruler-natural-height={rulerFrame.box.h}
              x1="0"
              y1={rulerFrame.box.y}
              x2="0"
              y2={rulerEnd}
              stroke="var(--gold)"
              strokeWidth="2"
              strokeOpacity="1"
            />
            <line x1="-7" y1={rulerFrame.box.y} x2="7" y2={rulerFrame.box.y} stroke="var(--gold)" strokeWidth="2" strokeOpacity="1" />
            <line x1="-7" y1={rulerEnd} x2="7" y2={rulerEnd} stroke="var(--gold)" strokeWidth="2" strokeOpacity="1" />
            {Array.from({ length: tickCount + 1 }, (_, tickIndex) => {
              const y = rulerFrame.box.y + tickIndex * PX_PER_MM
              const isCentimetre = tickIndex % 10 === 0
              return (
                <line
                  key={tickIndex}
                  x1={isCentimetre ? -5 : -3}
                  y1={y}
                  x2={isCentimetre ? 5 : 3}
                  y2={y}
                  stroke="var(--gold)"
                  strokeWidth={isCentimetre ? 1.25 : 0.75}
                  opacity={1}
                />
              )
            })}
          </g>
        </svg>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-sm bg-[var(--ink)] px-2 py-1 text-sm font-medium leading-none text-white"
        style={labelStyle}
      >
        {formatTrackSize(rulerLabelFrame.sizeCm)} CM
      </div>
    </>
  )
}

function StaticFace({ frame, className = '' }: { frame: HeroFrame; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[var(--bg)] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frame.imageUrl}
        alt={`Gilded Teardrop at ${formatSize(frame.sizeCm)} cm`}
        className="absolute inset-0 h-full w-full object-cover object-[56%_33%]"
      />
    </div>
  )
}

function ProductPanel({ className = '', compact = false, testId, style }: { className?: string; compact?: boolean; testId?: string; style?: React.CSSProperties }) {
  return (
    <figure data-testid={testId} className={`flex min-h-0 flex-col overflow-hidden bg-transparent ${className}`} style={style}>
      <div className={`flex min-h-0 flex-1 items-center justify-center ${compact ? 'p-2' : 'p-7 sm:p-10'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/products/teardrop-gold.png" alt="Gilded Teardrop earring" className="h-full w-full object-contain" />
      </div>
      <figcaption className={`w-full shrink-0 px-5 pb-5 text-sm text-[var(--ink-2)] sm:px-7 sm:pb-7 ${compact ? 'hidden' : ''}`}>
        In the photo, every size looks the same.
      </figcaption>
    </figure>
  )
}

function FinalGrid() {
  return (
    <div data-testid="hero-final-grid" className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3 min-[900px]:grid-cols-4 min-[900px]:grid-rows-1 min-[900px]:gap-5">
      {HERO_FRAMES.map((frame) => (
        <figure key={frame.sizeCm} className="relative min-h-0 overflow-hidden bg-[var(--bg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frame.imageUrl}
            alt={`Gilded Teardrop at ${formatSize(frame.sizeCm)} cm`}
            className="h-full w-full object-cover object-[56%_33%]"
          />
          <figcaption className="absolute bottom-3 left-4 bg-[var(--paper)] px-2 py-1 font-display text-xl leading-none sm:left-6 md:left-8 min-[900px]:left-10 lg:left-14 sm:text-2xl">
            {formatTrackSize(frame.sizeCm)} cm
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

export function HeroScrub() {
  const spacerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [stageSize, setStageSize] = useState({ width: 900, height: 640 })
  const [isNarrowScreen, setIsNarrowScreen] = useState(false)

  const { scrollYProgress } = useScroll({
    target: spacerRef,
    offset: ['start start', 'end end'],
  })
  const progress = clamp01(scrollProgress)
  const morphProgress = clamp01((progress - HERO_MORPH_START) / (HERO_MORPH_END - HERO_MORPH_START))
  const textExitProgress = clamp01((progress - HERO_TRANSITION_START) / (HERO_TEXT_EXIT_END - HERO_TRANSITION_START))
  const controlsEntrance = clamp01((progress - HERO_CONTROLS_START) / (HERO_CONTROLS_END - HERO_CONTROLS_START))
  const stage3Progress = smoothstep01((progress - 0.84) / 0.06)
  const stage2ExitProgress = smoothstep01((progress - HERO_STAGE_3_START) / 0.04)
  const stage2Opacity = 1 - stage2ExitProgress
  const stageWidth = stageSize.width
  const stageHeight = stageSize.height

  const stageOnePhoto = isNarrowScreen
    ? { left: 0, top: stageHeight * 0.47, width: stageWidth, height: stageHeight * 0.53 }
    : { left: stageWidth * 0.5, top: 0, width: stageWidth * 0.5, height: stageHeight }
  const stageTwoPhoto = isNarrowScreen
    ? { left: 0, top: 0, width: stageWidth, height: stageHeight * HERO_MOBILE_PHOTO_FRAME_FRACTION }
    : { left: 0, top: 0, width: stageWidth * (7 / 12), height: stageHeight }
  const photoRect = {
    left: interpolate(stageOnePhoto.left, stageTwoPhoto.left, morphProgress),
    top: interpolate(stageOnePhoto.top, stageTwoPhoto.top, morphProgress),
    width: interpolate(stageOnePhoto.width, stageTwoPhoto.width, morphProgress),
    height: interpolate(stageOnePhoto.height, stageTwoPhoto.height, morphProgress),
  }
  const photoRight = photoRect.left + photoRect.width
  const photoBottom = photoRect.top + photoRect.height
  const rightColumnRect = isNarrowScreen
    ? { left: 0, top: photoBottom, width: stageWidth, height: Math.max(stageHeight - photoBottom, 0) }
    : { left: photoRight, top: 0, width: Math.max(stageWidth - photoRight, 0), height: stageHeight }

  const productStart = isNarrowScreen
    ? { left: 0, top: 0, width: stageWidth, height: stageHeight * 0.47 }
    : { left: 0, top: 0, width: stageWidth * 0.5 - 12, height: stageHeight }
  const productTarget = isNarrowScreen
    ? {
        left: rightColumnRect.left + rightColumnRect.width - 64 - 16,
        top: rightColumnRect.top + 16,
        width: 64,
        height: 64,
      }
    : {
        left: rightColumnRect.left + rightColumnRect.width - 64 - 56,
        top: rightColumnRect.top + Math.max(16, rightColumnRect.height * 0.12),
        width: 64,
        height: 64,
      }
  const compactProductProgress = clamp01(morphProgress * 2)
  const productRect = morphProgress < 0.5
    ? {
        left: productStart.left,
        top: productStart.top,
        width: interpolate(productStart.width, 64, compactProductProgress),
        height: interpolate(productStart.height, 64, compactProductProgress),
      }
    : productTarget
  const productOpacity = progress >= HERO_MORPH_END ? stage2Opacity : 1

  const cameraStageSize = { width: Math.max(stageTwoPhoto.width, 1), height: Math.max(stageTwoPhoto.height, 1) }
  // Stage 2 uses one fixed size-6 camera for every render. The authored crop
  // fits the full photo rect, then the camera adds a gentle 1.00 -> 1.06 push-in.
  const cameraFrame = size6
  const stageOneZoom = 1 + 0.035 * clamp01(progress / HERO_MORPH_START)
  const cameraScaleValue = progress < HERO_STAGE_2_START_PROGRESS
    ? interpolate(stageOneZoom, HERO_STAGE_2_CAMERA_START, clamp01((progress - HERO_MORPH_START) / (HERO_STAGE_2_START_PROGRESS - HERO_MORPH_START)))
    : getHeroStage2CameraScale(progress)
  const camera = getHeroCameraTransform(cameraStageSize, cameraFrame, isNarrowScreen)
  const sizePosition = getHeroSizePositionForProgress(progress)
  const lowerFrameIndex = getHeroSizeFrameIndex(sizePosition)
  const sizeFraction = sizePosition - lowerFrameIndex
  const currentFrame = HERO_FRAMES[lowerFrameIndex]
  const incomingFrame = sizeFraction > 0 && lowerFrameIndex < HERO_FRAMES.length - 1 ? HERO_FRAMES[lowerFrameIndex + 1] : null
  const labelFrameIndex = getHeroStopIndexForProgress(progress)
  const labelFrame = HERO_FRAMES[labelFrameIndex]
  const interpolatedSize = getHeroSizeForProgress(progress)
  const rulerFrame: HeroFrame = {
    sizeCm: interpolatedSize,
    imageUrl: currentFrame.imageUrl,
    box: {
      x: interpolate(currentFrame.box.x, incomingFrame?.box.x ?? currentFrame.box.x, sizeFraction),
      y: interpolate(currentFrame.box.y, incomingFrame?.box.y ?? currentFrame.box.y, sizeFraction),
      w: interpolate(currentFrame.box.w, incomingFrame?.box.w ?? currentFrame.box.w, sizeFraction),
      h: interpolate(currentFrame.box.h, incomingFrame?.box.h ?? currentFrame.box.h, sizeFraction),
    },
  }
  const rulerCameraScale = progress < HERO_STAGE_2_START_PROGRESS ? cameraScaleValue : HERO_STAGE_2_CAMERA_START
  const rulerRect = mapHeroBoxToScreenRect(rulerFrame, cameraStageSize, rulerCameraScale, cameraFrame, isNarrowScreen)
  const rulerGapNatural = RULER_GAP_PX / Math.max(camera.coverScale * rulerCameraScale, 0.0001)
  const planeStyle: React.CSSProperties = {
    width: HERO_IMAGE_WIDTH * camera.coverScale,
    height: HERO_IMAGE_HEIGHT * camera.coverScale,
    left: camera.planeLeft,
    top: camera.planeTop,
  }
  const transformOrigin = `${camera.originX}px ${camera.originY}px`
  const introOpacity = progress < HERO_TRANSITION_START ? 1 : progress < HERO_TEXT_EXIT_END ? 1 - textExitProgress : 0
  const introRiseProgress = clamp01(progress / HERO_TEXT_EXIT_END)
  const introTransform = `translateY(${-(8 * introRiseProgress + 24 * textExitProgress)}px)`
  const controlsOpacity = controlsEntrance * stage2Opacity
  const blendOpacity = incomingFrame ? getHeroCrossfadeOpacity(sizeFraction) : 0
  const blendRegion = incomingFrame ? getHeroBlendRegion(currentFrame, incomingFrame) : null
  const wipeY = incomingFrame ? getHeroWipeY(sizeFraction) : null

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateReducedMotion = () => setPrefersReducedMotion(mediaQuery.matches)
    updateReducedMotion()
    mediaQuery.addEventListener('change', updateReducedMotion)
    return () => mediaQuery.removeEventListener('change', updateReducedMotion)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(max-width: 899px)')
    const updateNarrowScreen = () => setIsNarrowScreen(mediaQuery.matches)
    updateNarrowScreen()
    mediaQuery.addEventListener('change', updateNarrowScreen)
    return () => mediaQuery.removeEventListener('change', updateNarrowScreen)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const images = HERO_FRAMES.map((frame) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = frame.imageUrl
      return image
    })
    return () => images.forEach((image) => image.removeAttribute('src'))
  }, [])

  useMotionValueEvent(scrollYProgress, 'change', setScrollProgress)

  useLayoutEffect(() => {
    if (!stageRef.current) return
    const updateStageSize = () => {
      if (!stageRef.current) return
      const rect = stageRef.current.getBoundingClientRect()
      setStageSize({ width: rect.width, height: rect.height })
    }
    updateStageSize()
    const observer = new ResizeObserver(updateStageSize)
    observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [])

  const scrollToStop = (stopProgress: number) => {
    if (!spacerRef.current || typeof window === 'undefined') return
    const rect = spacerRef.current.getBoundingClientRect()
    const scrollable = Math.max(rect.height - window.innerHeight, 0)
    const top = window.scrollY + rect.top + scrollable * stopProgress
    window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }

  const trackStops = HERO_FRAMES.map((frame, index) => ({ frame, index, progress: HERO_STOP_PROGRESS[index] }))
  const photoStyle: React.CSSProperties = {
    left: photoRect.left,
    top: photoRect.top,
    width: photoRect.width,
    height: photoRect.height,
    opacity: stage2Opacity,
    visibility: stage2Opacity > 0 ? 'visible' : 'hidden',
    willChange: 'opacity',
  }
  const rightColumnStyle: React.CSSProperties = {
    left: rightColumnRect.left,
    top: rightColumnRect.top,
    width: rightColumnRect.width,
    height: rightColumnRect.height,
    opacity: controlsOpacity,
    transform: `translateY(${(1 - controlsEntrance) * 16}px)`,
    visibility: progress >= HERO_CONTROLS_START && progress < HERO_STAGE_3_START ? 'visible' : 'hidden',
    pointerEvents: progress >= HERO_CONTROLS_START && progress < HERO_STAGE_3_START ? 'auto' : 'none',
  }
  const productStyle: React.CSSProperties = {
    left: productRect.left,
    top: productRect.top,
    width: productRect.width,
    height: productRect.height,
    opacity: productOpacity,
    visibility: productOpacity > 0 && progress < HERO_STAGE_3_START + 0.04 ? 'visible' : 'hidden',
  }

  if (prefersReducedMotion) {
    return (
      <>
        {renderPreloadLinks()}
        <section aria-label="Gilded Teardrop sizes" data-testid="hero-reduced-motion" className="w-full bg-[var(--paper)] px-4 pb-20 pt-20 text-[var(--ink)] sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1600px]">
            <div className="max-w-3xl">
              <h1 className="font-display text-[clamp(48px,6vw,96px)] leading-none tracking-[-0.04em]">See it at its real size.</h1>
              <p className="mt-5 max-w-[42rem] text-lg leading-relaxed text-[var(--ink-2)]">Try any earring on your own photo, measured against your eye.</p>
            </div>
            <div className="mt-10 grid gap-4 min-[900px]:grid-cols-2 min-[900px]:gap-6">
              <ProductPanel testId="hero-reduced-product" className="min-h-[19rem] min-[900px]:h-[31rem]" />
              <figure className="flex min-h-[19rem] flex-col min-[900px]:h-[31rem]">
                <StaticFace frame={size3} className="min-h-0 flex-1" />
                <figcaption className="shrink-0 pt-4 text-sm text-[var(--ink-2)]">On you: 3.0 cm.</figcaption>
              </figure>
            </div>
            <div className="mt-16">
              <h2 className="max-w-xl font-display text-[clamp(36px,4vw,64px)] leading-none tracking-[-0.04em]">Every earring, on your own photo.</h2>
              <div className="mt-8"><FinalGrid /></div>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <Link href="/p/gilded-teardrop?tryon=1&size=3" className="inline-flex items-center bg-[var(--ink)] px-5 py-3 text-sm text-white transition-colors hover:bg-[var(--gold)]">Try on me</Link>
                <Link href="/collection" className="text-sm underline decoration-[var(--gold)] underline-offset-4">Browse the collection</Link>
              </div>
            </div>
            <Link href="/collection" className="mt-12 inline-block text-sm underline decoration-[var(--gold)] underline-offset-4">Skip to collection</Link>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      {renderPreloadLinks()}
      <div ref={spacerRef} className="relative h-[400vh] w-full" data-testid="hero-scrub">
        <section aria-label="Interactive physical size scrub" className="sticky top-[var(--header-h)] z-10 h-[calc(100dvh-var(--header-h))] w-full overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
          <div className="relative mx-auto h-full w-full max-w-[1600px] px-4 py-5 sm:px-6 md:px-8 md:py-7 min-[900px]:px-10 min-[900px]:py-8 lg:px-14">
            <div data-testid="hero-intro" className="absolute inset-x-4 top-5 z-30 sm:inset-x-6 md:inset-x-8 md:top-7 min-[900px]:inset-x-10 min-[900px]:top-8 lg:inset-x-14" style={{ visibility: progress >= HERO_TEXT_EXIT_END ? 'hidden' : 'visible', pointerEvents: progress >= HERO_TEXT_EXIT_END ? 'none' : 'auto' }}>
              <h1 data-testid="hero-intro-title" className="max-w-3xl font-display text-[clamp(48px,6vw,96px)] leading-[0.94] tracking-[-0.04em]" style={{ opacity: introOpacity, transform: introTransform }}>See it at its real size.</h1>
              <p className="mt-4 max-w-[42rem] text-base leading-relaxed text-[var(--ink-2)] sm:text-lg" style={{ opacity: introOpacity, transform: introTransform }}>Try any earring on your own photo, measured against your eye.</p>
              <Link href="/p/gilded-teardrop?tryon=1&size=3" className="mt-6 inline-flex w-fit bg-[var(--ink)] px-5 py-3 text-sm text-white transition-colors hover:bg-[var(--gold)]" style={{ opacity: introOpacity, transform: introTransform }}>Try on me</Link>
            </div>

            <div ref={stageRef} data-testid="hero-stage" className="absolute inset-x-4 bottom-5 top-5 sm:inset-x-6 md:inset-x-8 md:bottom-7 md:top-7 min-[900px]:inset-x-10 min-[900px]:bottom-8 min-[900px]:top-8 lg:inset-x-14">
              <ProductPanel testId="hero-product-panel" compact={morphProgress > 0.45} className="absolute z-10" style={productStyle} />
              <div data-testid="hero-photo" data-hero-stage2-opacity={stage2Opacity} className="absolute z-10 overflow-hidden bg-[var(--bg)]" style={photoStyle}>
                <MeasuredFace
                  frame={currentFrame}
                  incomingFrame={incomingFrame}
                  blendOpacity={blendOpacity}
                  blendRegion={blendRegion}
                  wipeY={wipeY}
                  cameraScale={cameraScaleValue}
                  coverScale={camera.coverScale}
                  rulerCameraScale={rulerCameraScale}
                  planeStyle={planeStyle}
                  transformOrigin={transformOrigin}
                  rulerFrame={rulerFrame}
                  rulerLabelFrame={labelFrame}
                  rulerRect={rulerRect}
                  rulerGapNatural={rulerGapNatural}
                  showRuler={progress >= HERO_MORPH_END && progress <= HERO_STAGE_3_START}
                />
              </div>
              <div data-testid="hero-right-column" data-hero-stage2-opacity={stage2Opacity} className="absolute z-20 flex flex-col justify-center px-4 py-4 text-right sm:px-8 sm:py-8 min-[900px]:px-10 lg:px-14" style={rightColumnStyle} aria-hidden={controlsOpacity === 0}>
                <div className="flex items-end justify-end gap-3" aria-live="polite">
                  <div className="relative h-[clamp(80px,13vw,140px)] overflow-hidden font-display text-[clamp(72px,14vw,160px)] leading-[0.72] tracking-[-0.06em] tabular-nums">
                    <span key={labelFrame.sizeCm} className="block" style={{ animation: 'hero-odometer 400ms cubic-bezier(.25,1,.5,1)' }}>{formatSize(labelFrame.sizeCm)}</span>
                  </div>
                  <span className="mb-3 text-base text-[var(--ink-2)]">cm</span>
                </div>
                <p key={`caption-${labelFrame.sizeCm}`} className="ml-auto max-w-[16rem] text-sm text-[var(--ink-2)]" style={{ animation: 'hero-caption 250ms ease-out' }}>{HERO_CAPTIONS[labelFrameIndex]}</p>
                <div className="relative mt-4 ml-auto h-14 w-full max-w-[30rem]" aria-label="Choose earring size">
                  <div className="absolute left-0 right-0 top-2 h-px bg-[var(--line)]" />
                  <span aria-hidden="true" data-testid="hero-size-dot" className="absolute top-0 z-10 h-4 w-4 -translate-x-1/2 rounded-full bg-[var(--gold)]" style={{ left: `${(sizePosition / (HERO_FRAMES.length - 1)) * 100}%` }} />
                  <div className="relative flex h-full justify-between">
                    {trackStops.map(({ frame, index, progress: stopProgress }) => {
                      const isCurrent = index === labelFrameIndex
                      return (
                        <button key={frame.sizeCm} type="button" onClick={() => scrollToStop(stopProgress)} className={`group flex flex-col items-center gap-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-4 ${isCurrent ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'}`} aria-label={`Show ${formatTrackSize(frame.sizeCm)} centimetre size`} aria-current={isCurrent ? 'true' : undefined}>
                          <span className={`h-3 w-px ${isCurrent ? 'bg-[var(--ink)]' : 'bg-[var(--line)]'} group-hover:bg-[var(--gold)]`} aria-hidden="true" />
                          <span className="font-display text-xl leading-none">{formatTrackSize(frame.sizeCm)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <Link href="/collection" className="pointer-events-auto mt-4 text-sm underline decoration-[var(--gold)] underline-offset-4 transition-colors hover:text-[var(--gold)]">Skip to collection</Link>
              </div>
            </div>

            <div data-testid="hero-final" data-hero-stage3-opacity={stage3Progress} className="pointer-events-none absolute inset-x-4 bottom-6 top-5 z-20 sm:inset-x-6 md:inset-x-8 md:bottom-6 md:top-7 min-[900px]:inset-x-10 min-[900px]:bottom-6 min-[900px]:top-8 lg:inset-x-14" style={{ opacity: stage3Progress, transform: `translateY(${Math.max(progress - 0.90, 0) * 8}px)`, visibility: stage3Progress > 0 ? 'visible' : 'hidden' }}>
              <div className="pointer-events-auto flex h-full min-h-0 flex-col justify-center overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col">
                  <h2 className="shrink-0 max-w-[16ch] font-display text-[clamp(42px,5vw,80px)] leading-[0.95] tracking-[-0.04em]">Every earring, on your own photo.</h2>
                  <div className="mt-4 flex h-[clamp(9rem,32vh,24rem)] min-h-0 flex-none overflow-hidden min-[900px]:h-[clamp(10rem,32vh,24rem)]"><FinalGrid /></div>
                  <div data-testid="hero-final-actions" className="mt-4 flex shrink-0 flex-wrap items-center gap-4">
                    <Link href="/p/gilded-teardrop?tryon=1&size=3" className="inline-flex items-center bg-[var(--ink)] px-5 py-3 text-sm text-white transition-colors hover:bg-[var(--gold)]">Try on me</Link>
                    <Link href="/collection" className="text-sm underline decoration-[var(--gold)] underline-offset-4 transition-colors hover:text-[var(--gold)]">Browse the collection</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div role="status" aria-live="polite" className="sr-only">Showing Gilded Teardrop at {formatSize(labelFrame.sizeCm)} centimetres</div>
      </div>
    </>
  )
}
