'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { apiClient, type SampleLook } from '@/lib/api-client'
import { RevealLines } from '../motion/Reveal'
import { getLookCaption } from './LookClient'
import styles from './LooksFrame.module.css'

export interface LookStep {
  /** Index of the look on screen. */
  index: number
  /** Index of the look that just left, or null before the first change. */
  previous: number | null
  /** Counts every change. Keys the caption and progress elements so their animations restart. */
  cycle: number
}

/** Moves to the next look, wrapping back to the first after the last. */
export function advanceLookStep(step: LookStep, count: number): LookStep {
  return { index: (step.index + 1) % count, previous: step.index, cycle: step.cycle + 1 }
}

// The active progress fill runs for 3200 ms (see the CSS module). Its animationend advances the frame,
// so the bar and the advance cannot drift apart, and pausing the bar pauses the advance.
export function LooksFrame() {
  const uid = useId()
  const headingId = `${uid}-heading`
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [looks, setLooks] = useState<SampleLook[]>([])
  const [step, setStep] = useState<LookStep>({ index: 0, previous: null, cycle: 0 })
  const [inView, setInView] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  const count = looks.length
  const autoplay = count > 1 && inView && pageVisible && !reducedMotion

  // Same endpoint and fields as LookClient.
  useEffect(() => {
    let mounted = true
    apiClient
      .getSamples()
      .then((samples) => {
        if (mounted) setLooks(samples)
      })
      .catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [])

  // Auto-advance only while at least 40% of the frame is on screen.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting && entry.intersectionRatio >= 0.4)
      },
      { threshold: 0.4 },
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [count])

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState === 'visible')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const advance = () => {
    if (count < 2) return
    setStep((current) => advanceLookStep(current, count))
  }

  const onFrameKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    advance()
  }

  if (count === 0) return null

  const current = looks[step.index] ?? looks[0]
  const previous = step.previous === null ? undefined : looks[step.previous]

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <RevealLines id={headingId} as="h2" text="Styled on the same face." className={styles.heading} />

      <div className={styles.column}>
        <div
          ref={frameRef}
          role="button"
          tabIndex={0}
          aria-label="Next look"
          className={styles.frame}
          onClick={advance}
          onKeyDown={onFrameKeyDown}
        >
          {looks.map((look, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={look.id}
              src={look.imageUrl}
              alt={`${look.title} result`}
              width={800}
              height={1000}
              loading={index === 0 ? 'eager' : 'lazy'}
              className={index === step.index ? `${styles.image} ${styles.imageActive}` : styles.image}
            />
          ))}
        </div>

        <p className={styles.caption}>
          {previous && (
            <span
              key={`out-${step.cycle}`}
              aria-hidden="true"
              className={`${styles.captionLine} ${styles.captionOut}`}
            >
              {getLookCaption(previous)}
            </span>
          )}
          <span
            key={`in-${step.cycle}`}
            className={step.cycle > 0 ? `${styles.captionLine} ${styles.captionIn}` : styles.captionLine}
          >
            {getLookCaption(current)}
          </span>
        </p>

        {count > 1 && (
          <div className={styles.progress} aria-hidden="true">
            {looks.map((look, index) => {
              if (index === step.index) {
                return (
                  <span key={look.id} className={styles.segment}>
                    <span
                      key={step.cycle}
                      className={`${styles.fill} ${styles.fillRun}`}
                      style={{ animationPlayState: autoplay ? 'running' : 'paused' }}
                      onAnimationEnd={autoplay ? advance : undefined}
                    />
                  </span>
                )
              }
              return (
                <span key={look.id} className={styles.segment}>
                  {index < step.index && <span className={`${styles.fill} ${styles.fillDone}`} />}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
