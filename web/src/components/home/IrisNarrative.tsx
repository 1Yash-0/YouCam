'use client'

import React, { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { remap, easeOutCubic } from '@/hooks/useScrollProgress'
import sampleFace from '../../../data/sample-face.json'
import size3 from '../../../public/hero/size-3.json'
import styles from './IrisNarrative.module.css'

export interface IrisNarrativeProps {
  id?: string
  className?: string
}

const IMAGE_WIDTH = sampleFace.image.w
const IMAGE_HEIGHT = sampleFace.image.h

/** The three stages of the explanation, in plain words. */
const STAGES = ['Capture', 'Calibrate', 'Render'] as const

/** Approximate size of the calibrate label; it only keeps the label inside the stage. */
const CALIPER_LABEL_W = 136
const CALIPER_LABEL_H = 28

export function IrisNarrative({ id = 'how-it-works', className = '' }: IrisNarrativeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [pinnedProgress, setPinnedProgress] = useState(0)
  const [isStaticLayout, setStaticLayout] = useState(false)
  const [manualStep, setManualStep] = useState(0)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [tabRule, setTabRule] = useState<Array<{ left: number; width: number }>>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 1023px), (max-height: 619px)')
    setStaticLayout(mq.matches)
    const handler = (e: MediaQueryListEvent) => setStaticLayout(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const updateStageSize = () => {
      const rect = stage.getBoundingClientRect()
      setStageSize({ width: rect.width, height: rect.height })
    }

    updateStageSize()
    const observer = new ResizeObserver(updateStageSize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // Measure the tabs so the gold rule can slide under the active one. Measure again once fonts load.
  useEffect(() => {
    const measure = () => {
      setTabRule(tabRefs.current.map(tab => ({ left: tab?.offsetLeft ?? 0, width: tab?.offsetWidth ?? 0 })))
    }
    measure()
    window.addEventListener('resize', measure)
    void document.fonts?.ready.then(measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    if (isStaticLayout || typeof window === 'undefined') return

    const handleScroll = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const headerHeight = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--header-h'),
      ) || 72
      const viewportHeight = Math.max(window.innerHeight - headerHeight, 1)
      const distance = rect.height - viewportHeight
      if (distance <= 0) return

      if (rect.top > 0) {
        setPinnedProgress(0)
      } else if (rect.top < -distance) {
        setPinnedProgress(1)
      } else {
        const p = -rect.top / distance
        setPinnedProgress(Math.min(Math.max(p, 0), 1))
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isStaticLayout])

  const tau = isStaticLayout ? manualStep / 2 : pinnedProgress
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

  const irisPx = sampleFace.iris.px
  const pxPerCm = (irisPx / 1.17).toFixed(1)
  const coverScale = stageSize.width > 0 && stageSize.height > 0
    ? Math.max(stageSize.width / IMAGE_WIDTH, stageSize.height / IMAGE_HEIGHT)
    : 1
  const renderedImageWidth = IMAGE_WIDTH * coverScale
  const renderedImageHeight = IMAGE_HEIGHT * coverScale
  const imageOffsetX = (stageSize.width - renderedImageWidth) / 2
  const imageOffsetY = (stageSize.height - renderedImageHeight) / 2
  const irisWidth = sampleFace.iris.x2 - sampleFace.iris.x1
  const rulerX = (size3.box.x + size3.box.w + 16) * coverScale
  const rulerTop = size3.box.y * coverScale
  const rulerHeight = size3.box.h * coverScale
  const imageOriginX = renderedImageWidth * (originX / 100)
  const imageOriginY = renderedImageHeight * (originY / 100)
  const caliperOverlayX = sampleFace.iris.x1 * coverScale
  const caliperOverlayY = (sampleFace.iris.y - 28) * coverScale
  const caliperAnchorX = imageOffsetX + imageOriginX + ((caliperOverlayX + (irisWidth * coverScale) / 2) - imageOriginX) * scale
  const caliperAnchorY = imageOffsetY + imageOriginY + (caliperOverlayY - imageOriginY) * scale
  // The label is centred on its anchor (translateX -50%), kept clear of the stage edges.
  const labelHalfW = CALIPER_LABEL_W / 2
  const caliperLabelLeft = Math.min(
    Math.max(caliperAnchorX, 12 + labelHalfW),
    Math.max(12 + labelHalfW, stageSize.width - 12 - labelHalfW),
  )
  const caliperLabelTop = Math.max(
    12,
    Math.min(caliperAnchorY - CALIPER_LABEL_H - 12, Math.max(12, stageSize.height - CALIPER_LABEL_H - 12)),
  )
  const activeRule = tabRule[activeStep]

  return (
    <section
      id={id}
      ref={containerRef}
      className={`${styles.section} ${isStaticLayout ? styles.flow : styles.pinned} ${className}`}
      aria-label="How earring scale is estimated"
    >
      <div className={`${styles.frame} ${isStaticLayout ? styles.flowFrame : styles.pinnedFrame}`}>
        <div className={styles.header}>
          <h2 className={styles.title}>From pixels to drop length.</h2>

          <div className={styles.tabs} role="group" aria-label="Explanation stages">
            {STAGES.map((label, idx) => (
              <button
                key={label}
                ref={el => { tabRefs.current[idx] = el }}
                type="button"
                className={styles.tab}
                aria-current={activeStep === idx ? 'step' : undefined}
                disabled={!isStaticLayout}
                onClick={() => setManualStep(idx)}
              >
                {label}
              </button>
            ))}
            {activeRule && (
              <span
                aria-hidden="true"
                className={styles.tabRule}
                style={{ transform: `translateX(${activeRule.left}px) scaleX(${activeRule.width})` }}
              />
            )}
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.copy}>
            <div className={styles.copyPane}>
              {activeStep === 0 && (
                <div className={styles.step}>
                  <h3 className={styles.stepTitle}>Earring placement on a photo</h3>
                  <p className={styles.stepText}>
                    The sample flow uses eye and earlobe landmarks to place an earring on the photo. Photo angle and framing can affect the result.
                  </p>
                  <p className={styles.stepMeta}>Sample photo</p>
                </div>
              )}

              {activeStep === 1 && (
                <div className={styles.step}>
                  <h3 className={styles.stepTitle}>An iris reference</h3>
                  <p className={styles.stepText}>
                    An adult iris is about 11.7 mm wide on average. We use that as an earring scale reference; it is not a measurement of every shopper’s iris.
                  </p>
                  <p className={styles.stepMeta}>
                    {irisPx} px in this sample (about 11.7 mm average reference · {pxPerCm} px/cm)
                  </p>
                </div>
              )}

              {activeStep === 2 && (
                <div className={styles.step}>
                  <h3 className={styles.stepTitle}>A render check</h3>
                  <p className={styles.stepText}>
                    We compare the rendered earring with the selected product size. This checks the render, not how large it will look on every person or screen.
                  </p>
                  <Link href="/p/gilded-teardrop?tryon=1" className={styles.stepAction}>Try on the sample face</Link>
                </div>
              )}
            </div>
          </div>

          <div className={styles.stageCol}>
            <div ref={stageRef} className={styles.stage}>
              <div
                className={styles.scaler}
                style={{
                  width: `${renderedImageWidth}px`,
                  height: `${renderedImageHeight}px`,
                  left: `${imageOffsetX}px`,
                  top: `${imageOffsetY}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: `${originX}% ${originY}%`,
                }}
              >
                <Image
                  src="/sample-face.png"
                  alt="Iris calibration reference"
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className={`${styles.layer} ${styles.photo} ${activeStep === 2 ? styles.layerOff : styles.layerOn}`}
                  priority
                  aria-hidden={activeStep === 2}
                />
                <Image
                  src="/hero/size-3.webp"
                  alt="Gilded Teardrop shown at 3.0 cm"
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className={`${styles.layer} ${styles.photo} ${activeStep === 2 ? styles.layerOn : styles.layerOff}`}
                  priority
                  aria-hidden={activeStep !== 2}
                />

                {activeStep === 1 && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${sampleFace.iris.x1 * coverScale}px`,
                      top: `${(sampleFace.iris.y - 28) * coverScale}px`,
                      width: `${irisWidth * coverScale}px`,
                      height: `${56 * coverScale}px`,
                    }}
                  >
                    <div className="absolute inset-x-0 bottom-0 h-12 flex items-center">
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--gold)]">
                        <div className="absolute -top-1 -left-[3px] w-2 h-2 rotate-45 bg-[var(--gold)]" />
                        <div className="absolute -bottom-1 -left-[3px] w-2 h-2 rotate-45 bg-[var(--gold)]" />
                      </div>
                      <div className="w-full border-t border-dashed border-[var(--gold)]" />
                      <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-[var(--gold)]">
                        <div className="absolute -top-1 -right-[3px] w-2 h-2 rotate-45 bg-[var(--gold)]" />
                        <div className="absolute -bottom-1 -right-[3px] w-2 h-2 rotate-45 bg-[var(--gold)]" />
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${rulerX}px`,
                      top: `${rulerTop}px`,
                      height: `${rulerHeight}px`,
                    }}
                    aria-label="Measured 3.0 cm earring ruler"
                  >
                    <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--gold)]" />
                    <div className="absolute left-0 top-0 w-8 border-t-2 border-[var(--gold)]" />
                    <div className="absolute left-0 bottom-0 w-8 border-t-2 border-[var(--gold)]" />
                    <div className={`${styles.label} ${styles.rulerLabel}`}>{size3.sizeCm.toFixed(1)} cm</div>
                  </div>
                )}
              </div>

              {activeStep === 1 && stageSize.width > 0 && (
                <div
                  className={styles.label}
                  style={{
                    left: `${caliperLabelLeft}px`,
                    top: `${caliperLabelTop}px`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {irisPx} px = 11.7 mm
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ transform: `scaleX(${tau})` }} />
        </div>
      </div>
    </section>
  )
}
