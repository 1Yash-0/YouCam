import React from 'react'
import Link from 'next/link'

import { PrintRows, RevealLines } from '../motion/Reveal'
import styles from './HowSlip.module.css'

const SLIP_WIDTH_PX = 440
const SLIP_TOOTH_PX = 12

/**
 * Bottom zig-zag of the receipt slip as a clip-path polygon, with 12 px teeth.
 * Horizontal positions are percentages of the 440 px design width, so the teeth scale with the slip.
 * The depth uses calc() so it stays 12 px at every width.
 */
export function buildSlipClipPath(): string {
  const valley = `calc(100% - ${SLIP_TOOTH_PX}px)`
  const toPercent = (px: number) => `${Number(((px / SLIP_WIDTH_PX) * 100).toFixed(3))}%`
  const points = ['0% 0%', '100% 0%', `100% ${valley}`]
  let x = SLIP_WIDTH_PX
  let tip = true
  while (x > 0) {
    x = Math.max(0, x - SLIP_TOOTH_PX)
    points.push(`${toPercent(x)} ${tip ? '100%' : valley}`)
    tip = !tip
  }
  return `polygon(${points.join(', ')})`
}

const SLIP_CLIP_PATH = buildSlipClipPath()

const STEPS = [
  { thumb: '/mirror/thumbs/sample-face.webp', label: 'Your photo, or our sample', time: '10 s' },
  { thumb: '/mirror/thumbs/scale.webp', label: 'We find the scale on your body', time: '2 s' },
  { thumb: '/mirror/thumbs/worn.webp', label: 'Pick a size, see it worn', time: 'about 10 s' },
]

const TOTAL = { label: 'A photo of it on you, true to size', time: 'under 1 min' }

export function HowSlip() {
  return (
    <section className={styles.section} aria-labelledby="how-slip-title">
      <div className={styles.grid}>
        <RevealLines
          id="how-slip-title"
          as="h2"
          text="Three steps. About a minute."
          className={styles.heading}
        />
        <div className={styles.slipColumn}>
          <div className={styles.slip} style={{ clipPath: SLIP_CLIP_PATH }}>
            <PrintRows as="ul" className={styles.rows}>
              {STEPS.map((step) => (
                <li key={step.label} className={styles.row} data-row="">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.thumb} src={step.thumb} alt="" width={40} height={40} />
                  <span>{step.label}</span>
                  <span className={styles.fill} aria-hidden="true" />
                  <span className={styles.time}>{step.time}</span>
                </li>
              ))}
              <li className={`${styles.row} ${styles.total}`} data-row="">
                <span>{TOTAL.label}</span>
                <span className={styles.time}>{TOTAL.time}</span>
              </li>
            </PrintRows>
          </div>
          <Link href="/how-it-works" className={`link-draw ${styles.more}`}>
            How sizing works
          </Link>
        </div>
      </div>
    </section>
  )
}
