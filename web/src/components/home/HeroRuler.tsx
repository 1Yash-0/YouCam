'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { heroFrameIndex, heroLayout, heroScrollDistance, heroSizeStage, type HeroSizeStage } from '@/lib/hero-motion'

export interface RulerWindow {
  id: 'ear' | 'neck' | 'ring' | 'watch'
  title: string
  href: string
  measure: string
  labels: string[]
  alt: string[]
  /** Scale bar: real length in mm, and source px per mm divided by the crop width (strip is 520x832 of that crop) */
  scale: { mm: number; label: string; perCropWidth: number }
}

// px/mm in the source renders: profile face iris 41 px = 11.7 mm (data/sample-face.json); front face iris 36 px;
// demo wrist 5.312 px/mm (watch calibration, r6; 34/38/42 mm renders measured within 1 px). Divided by crop widths.
export const RULER_WINDOWS: RulerWindow[] = [
  { id: 'ear', title: 'Earrings', href: '/collection?category=drops', measure: 'Drop', labels: ['2 cm', '3 cm', '4.5 cm', '6 cm'],
    alt: ['2 cm gold teardrop earring on the sample face', '3 cm gold teardrop earring', '4.5 cm gold teardrop earring', '6 cm gold teardrop earring'],
    scale: { mm: 20, label: '2 cm', perCropWidth: (41 / 11.7) / 440 } },
  { id: 'neck', title: 'Necklaces', href: '/collection?category=necklaces', measure: 'Chain', labels: ['about 39 cm', 'about 44 cm', 'about 48 cm'],
    alt: ['Gold chain worn at about 39 cm', 'The same chain at about 44 cm', 'The same chain at about 48 cm'],
    scale: { mm: 50, label: '5 cm', perCropWidth: (36 / 11.7) / 700 } },
  { id: 'ring', title: 'Rings', href: '/collection?category=rings', measure: 'Stone', labels: ['about 10 mm', 'about 12 mm', 'about 14 mm'],
    alt: ['Gold ring with a carnelian stone about 10 mm long, on a size 7 finger', 'The same ring with a 12 mm stone', 'The same ring with a 14 mm stone'],
    // the band wraps the finger, so finger width (107 px) = ring size US 7 (17.3 mm, assumed average)
    scale: { mm: 10, label: '1 cm', perCropWidth: (107 / 17.3) / 320 } },
  { id: 'watch', title: 'Watches', href: '/collection?category=watches', measure: 'Case', labels: ['34 mm', '38 mm', '42 mm'],
    alt: ['34 mm watch on the wrist', 'The same watch at 38 mm', 'The same watch at 42 mm'],
    scale: { mm: 20, label: '2 cm', perCropWidth: 5.312 / 560 } },
]


export function scaleBarPx(w: RulerWindow, cw: number, ch: number) {
  return w.scale.mm * w.scale.perCropWidth * Math.min(cw, ch * 5 / 8)
}

type ManualSizes = Partial<Record<RulerWindow['id'], number>>

function RulerPhoto({ window: w, index, onSelect }: { window: RulerWindow; index: number; onSelect: (value: number) => void }) {
  const [failed, setFailed] = useState<number[]>([])
  return <article className="hero-ruler-window" data-ruler-window={w.id} data-size-index={index}>
    <Link href={w.href} className="hero-ruler-photo" aria-label={`Browse ${w.title}`}>
      {w.labels.map((_, frame) => <img key={frame} data-hero-frame={frame}
        src={`/hero/strip/${w.id}-${frame}.webp`} alt={frame === index ? w.alt[frame] : ''}
        aria-hidden={frame !== index} width={520} height={832} loading="eager" decoding="async"
        className="hero-ruler-image" style={{ opacity: frame === 0 ? 1 : 0 }} draggable={false}
        onError={() => setFailed(current => current.includes(frame) ? current : [...current, frame])} />)}
      {failed.includes(index) && <span className="hero-image-error" role="status">This size preview is unavailable. Choose another size below.</span>}
    </Link>
    <div className="hero-scale" aria-hidden="true">
      <span className="hero-scale-bar" style={{ width: `${w.scale.mm * w.scale.perCropWidth * 100}%` }} />
      <span>{w.scale.label}</span>
    </div>
    <div className="hero-ruler-meta">
      <Link href={w.href} className="font-display">{w.title}</Link>
      <label className="hero-size-select">
        <span className="sr-only">{w.title} size</span>
        <select value={index} onChange={event => onSelect(Number(event.target.value))} aria-label={`${w.title} size`}>
          {w.labels.map((label, frame) => <option key={label} value={frame}>{label}</option>)}
        </select>
        <svg viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="m1 1 5 5 5-5" stroke="currentColor" strokeWidth="1.3" /></svg>
      </label>
    </div>
  </article>
}

export function HeroRuler() {
  const rootRef = useRef<HTMLElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const availableRef = useRef<HTMLDivElement>(null)
  const compositionRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<HeroSizeStage>(0)
  const [manual, setManual] = useState<ManualSizes>({})
  const [mode, setMode] = useState<'static' | 'scroll'>('static')
  const [reduced, setReduced] = useState(false)
  const manualRef = useRef<ManualSizes>({})
  const stageRef = useRef<HeroSizeStage>(0)
  const renderFrames = useRef<((immediate?: boolean) => void) | null>(null)

  useEffect(() => {
    const root = rootRef.current!, gallery = galleryRef.current!, available = availableRef.current!
    const composition = compositionRef.current!, grid = gridRef.current!
    gsap.registerPlugin(ScrollTrigger)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const images = Array.from(root.querySelectorAll<HTMLImageElement>('[data-hero-frame]'))
    const bars = root.querySelectorAll<HTMLElement>('.hero-scale-bar')
    const rail = root.querySelector<HTMLElement>('.hero-ruler-progress')!
    const frameCache = new Map<string, number>()
    let timeline: gsap.core.Timeline | undefined
    let disposed = false, ready = false, resizeFrame = 0
    let lastWidth = 0, lastHeight = 0
    const query = new URLSearchParams(window.location.search).get('heroP')
    const forced = query !== null && Number.isFinite(Number(query)) ? Math.max(0, Math.min(1, Number(query))) : null
    const context = gsap.context(() => {
      const lines = root.querySelectorAll('[data-hero-line]')
      gsap.fromTo(lines, { opacity: .45, yPercent: media.matches ? 0 : 45 }, {
        opacity: 1, yPercent: 0, duration: media.matches ? .15 : .55,
        stagger: media.matches ? 0 : .045, ease: 'power3.out', clearProps: 'transform,opacity',
      })
    }, root)

    const showFrames = (immediate = false) => {
      RULER_WINDOWS.forEach(w => {
        const frame = manualRef.current[w.id] ?? heroFrameIndex(w.labels.length, stageRef.current)
        if (!immediate && frameCache.get(w.id) === frame) return
        frameCache.set(w.id, frame)
        const layers = root.querySelectorAll<HTMLImageElement>(`[data-ruler-window="${w.id}"] [data-hero-frame]`)
        gsap.killTweensOf(layers)
        const opacity = (index: number) => index === frame ? 1 : 0
        if (immediate) gsap.set(layers, { opacity })
        else gsap.to(layers, { opacity, duration: media.matches ? .12 : .18, ease: 'power2.out', overwrite: true })
      })
    }
    renderFrames.current = showFrames
    const updateStage = (progress: number, immediate = false) => {
      root.dataset.heroProgress = progress.toFixed(4)
      const next = heroSizeStage(progress)
      if (stageRef.current !== next) {
        stageRef.current = next
        setStage(next)
        showFrames(immediate)
      }
    }
    const configure = () => {
      if (!ready || disposed) return
      if (media.matches) {
        const lines = root.querySelectorAll('[data-hero-line]')
        gsap.killTweensOf(lines)
        gsap.set(lines, { clearProps: 'transform,opacity' })
      }
      timeline?.scrollTrigger?.kill(true)
      timeline?.kill()
      timeline = undefined
      composition.style.width = '100%'
      const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72
      const columns: 2 | 4 = window.innerWidth >= 1024 ? 4 : 2
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap)
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-ruler-window]'))
      const cardChrome = Math.max(...cards.map(card => card.offsetHeight - card.querySelector<HTMLElement>('.hero-ruler-photo')!.offsetHeight))
      const layout = heroLayout({ availableWidth: available.clientWidth, viewportHeight: window.innerHeight,
        headerHeight: header, galleryChrome: gallery.offsetHeight - grid.offsetHeight,
        cardChrome, columns, gap, reduced: media.matches })
      composition.style.width = `${layout.width}px`
      // Text may wrap differently at the fitted width. If it cannot fit, use natural flow.
      const pin = layout.pin && gallery.offsetHeight <= window.innerHeight - header
      if (!pin) composition.style.width = '100%'
      setReduced(media.matches)
      setMode(pin && forced === null ? 'scroll' : 'static')
      if (pin && forced === null) {
        context.add(() => {
          timeline = gsap.timeline({ scrollTrigger: {
            id: 'darpan-hero', trigger: gallery, start: () => `top ${header}px`,
            end: () => `+=${heroScrollDistance(window.innerHeight)}`, pin: true,
            pinSpacing: true, scrub: .16, anticipatePin: 1, invalidateOnRefresh: true,
          } })
          timeline.fromTo(rail, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'none' }, 0)
          timeline.fromTo(bars, { scaleX: 0 }, { scaleX: 1, duration: .14, ease: 'power2.out' }, 0)
          timeline.eventCallback('onUpdate', () => updateStage(timeline!.progress()))
        })
        timeline!.scrollTrigger!.refresh()
        updateStage(timeline!.progress(), true)
      } else {
        gsap.set([rail, ...Array.from(bars)], { scaleX: 1 })
        updateStage(forced ?? 0, true)
      }
      showFrames(true)
      lastWidth = available.clientWidth
      lastHeight = window.innerHeight
    }
    const schedule = () => {
      if (disposed || !ready || resizeFrame) return
      resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; configure() })
    }
    const observer = new ResizeObserver(() => {
      if (available.clientWidth !== lastWidth) schedule()
    })
    observer.observe(available)
    const resize = () => { if (available.clientWidth !== lastWidth || window.innerHeight !== lastHeight) schedule() }
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', schedule)
    media.addEventListener('change', schedule)
    Promise.all([document.fonts.ready, ...images.map(image => image.decode().catch(() => undefined))]).then(() => {
      if (!disposed) { ready = true; configure() }
    })
    return () => {
      disposed = true
      cancelAnimationFrame(resizeFrame)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', schedule)
      media.removeEventListener('change', schedule)
      renderFrames.current = null
      timeline?.scrollTrigger?.kill(true)
      timeline?.kill()
      gsap.killTweensOf(images)
      context.revert()
    }
  }, [])

  function select(id: RulerWindow['id'], value: number) {
    manualRef.current = { ...manualRef.current, [id]: value }
    setManual(manualRef.current)
    renderFrames.current?.()
  }
  function followScroll() {
    manualRef.current = {}
    setManual({})
    renderFrames.current?.()
  }
  const hasManual = Object.keys(manual).length > 0
  return <section ref={rootRef} className="hero-ruler" aria-label="Estimated-scale jewellery previews" data-testid={reduced ? 'hero-ruler-reduced' : 'hero-ruler'} data-hero-mode={mode}>
    <div className="hero-intro">
      <h1><span className="hero-line-mask"><span data-hero-line>A little bigger.</span></span><span className="hero-line-mask"><span data-hero-line>A different look.</span></span></h1>
      <div className="hero-intro-copy">
        <p>See what size changes. Try jewellery on your photo, then compare the proportions.</p>
        <div className="hero-intro-actions"><Link href="/try-on/gilded-teardrop?sample=1" className="studio-primary">Try a sample</Link><Link href="/collection" className="motion-link">Browse the collection</Link></div>
      </div>
    </div>
    <div ref={galleryRef} className="hero-ruler-gallery">
      <div ref={availableRef} className="hero-gallery-space">
        <div ref={compositionRef} className="hero-ruler-composition">
          <div className="hero-gallery-heading"><p>{mode === 'scroll' ? 'Scroll to see the difference.' : 'Choose a size. See the difference.'}</p><button type="button" className="motion-link" style={{ visibility: hasManual ? 'visible' : 'hidden' }} disabled={!hasManual} onClick={followScroll}>Follow scroll</button></div>
          <div className="hero-ruler-track" aria-hidden="true"><span className="hero-ruler-progress" /></div>
          <div ref={gridRef} className="hero-ruler-row">
            {RULER_WINDOWS.map(w => <RulerPhoto key={w.id} window={w} index={manual[w.id] ?? heroFrameIndex(w.labels.length, stage)} onSelect={value => select(w.id, value)} />)}
          </div>
          <div className="hero-gallery-foot"><span>Photo-based scale estimates.</span><Link href="/how-it-works" className="motion-link">How we scale jewellery</Link></div>
        </div>
      </div>
    </div>
  </section>
}
