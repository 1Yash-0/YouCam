'use client'

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'

import { RevealLines, prefersReducedMotion, registerScrollTrigger } from '../motion/Reveal'
import styles from './ClosingCta.module.css'

/** Closing call to action: the sample earring fills the frame, and the copy sits in the right half. */
export function ClosingCta() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    const image = imageRef.current
    if (!section || !image || prefersReducedMotion()) return
    registerScrollTrigger()

    // The photo settles from 1.08 to 1 while the section crosses the viewport. Transform only.
    const ctx = gsap.context(() => {
      gsap.fromTo(
        image,
        { scale: 1.08 },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      )
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="closing-cta-title">
      <div className={styles.media}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          className={styles.image}
          src="/mirror/closing.webp"
          alt="Gold teardrop earring worn on the sample face"
          width={1104}
          height={1292}
          loading="lazy"
        />
      </div>
      <div className={styles.copy}>
        <RevealLines id="closing-cta-title" as="h2" text="Your photo next." className={styles.heading} />
        <Link href="/try-on/gilded-teardrop?sample=1" className={styles.button} data-press="">
          Try it on
        </Link>
        <p className={styles.note}>Photos are used only for your try-on.</p>
      </div>
    </section>
  )
}
