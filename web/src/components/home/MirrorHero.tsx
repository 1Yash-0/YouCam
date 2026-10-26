'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  MIRROR,
  blend,
  chapterAt,
  framePos,
  nearestFrame,
  parseLabel,
  progressForChapterStart,
  rulerOffsetPx,
  toMm,
  type MirrorChapter,
} from '@/lib/mirror'
import { scrollToY } from '@/components/SmoothScroll'
import styles from './MirrorHero.module.css'

// Homepage size sequence. Desktop and compact layouts pin a stage and step through the frames as the
// visitor scrolls; short or reduced-motion viewports get a static list. Per-frame work runs on the GSAP
// ticker and writes to the DOM directly, so React does not re-render during scroll.

type Mode = 'desktop' | 'compact' | 'static'
type Layout = Exclude<Mode, 'static'>
type Odometer = { key: string; cols: HTMLElement[]; cells: HTMLElement[] }
type Override = { chapter: number; pos: number; p0: number }
type Drag = { id: number; x: number; y: number; start: number }

const N = MIRROR.length
const TITLE_ID = 'mirror-title'
const HINT_KEY = 'darpan_ruler_used'
const RULER_W = 56 // vertical ruler width, px
const RULER_H = 48 // horizontal ruler height, px
const DRAG_PX = 22 // pointer travel per frame step, px
const SVG_NS = 'http://www.w3.org/2000/svg'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Desktop and compact pin the stage. Reduced motion or a short viewport gets the static list. */
function modeFor(width: number, height: number, reduce: boolean): Mode {
  if (reduce || height < 600) return 'static'
  return width >= 1024 && height >= 640 ? 'desktop' : 'compact'
}

const frameSrc = (c: MirrorChapter, i: number, size: 'l' | 's') => `/mirror/${c.id}/${i}-${size}.webp`
// Numbers only on the tape: the unit is in the readout beside it, and "10 mm" does not fit a 56px ruler.
const labelFor = (c: MirrorChapter, mm: number) => (c.unit === 'cm' ? `${mm / 10}` : `${mm}`)

function svgEl(tag: string, attrs: Record<string, string | number>, cls: string, text?: string): SVGElement {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  el.setAttribute('class', cls)
  if (text !== undefined) el.textContent = text
  return el
}

/** One chapter's ruler: ticks from 0 to the largest size plus 20 mm, on a tape longer than that. */
function buildTape(c: MirrorChapter, ppm: number, vertical: boolean, len: number): SVGSVGElement {
  let major = c.unit === 'cm' ? 10 : 5 // mm between labels, doubled until the labels fit
  while (major * ppm < (vertical ? 18 : 44)) major *= 2
  const minor = ppm >= 4 ? 1 : 5
  const endMm = Math.ceil(Math.max(...c.frames.map((f) => toMm(f.measured, c.unit))) + 20)
  // Only the stretch that can ever sit in view gets ticks (a 39 cm chain needs none from 0 to 30 cm).
  const startMm = Math.max(0, Math.floor((Math.min(...c.frames.map((f) => toMm(f.measured, c.unit))) - len / 2 / ppm - 10) / major) * major)
  const span = endMm * ppm + len
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
  svg.setAttribute('width', String(vertical ? RULER_W : span))
  svg.setAttribute('height', String(vertical ? span : RULER_H))
  svg.setAttribute('aria-hidden', 'true')
  for (let mm = startMm; mm <= endMm; mm += minor) {
    const p = mm * ppm
    const isMajor = mm % major === 0
    const tick = isMajor ? 16 : 8
    if (vertical) {
      svg.append(svgEl('line', { x1: RULER_W - tick, y1: p, x2: RULER_W, y2: p }, styles.tick))
      if (isMajor) svg.append(svgEl('text', { x: RULER_W - 22, y: p + 4.5, 'text-anchor': 'end' }, styles.tickLabel, labelFor(c, mm)))
    } else {
      svg.append(svgEl('line', { x1: p, y1: 0, x2: p, y2: tick }, styles.tick))
      if (isMajor) svg.append(svgEl('text', { x: p, y: 30, 'text-anchor': 'middle' }, styles.tickLabel, labelFor(c, mm)))
    }
  }
  return svg
}

/** Odometer: each digit is a column of 0-9 that slides to the new digit. Rebuilt only if the shape changes. */
function setNumber(host: HTMLElement, text: string, prev: Odometer | null): Odometer {
  const chars = text.split('')
  const key = text.replace(/\d/g, '#')
  // Gloock has proportional figures, so each digit window takes the width of the digit it shows
  // (measured once per font size); otherwise a narrow "1" leaves a gap in a column sized for "0".
  const widths = digitWidths(host)
  const place = (cell: HTMLElement, col: HTMLElement, d: number) => {
    col.style.transform = `translateY(${-d}em)`
    cell.style.width = `${widths[d]}px`
  }
  if (prev && prev.key === key) {
    let k = 0
    for (const ch of chars) {
      if (/\d/.test(ch)) { place(prev.cells[k], prev.cols[k], Number(ch)); k++ }
    }
    return prev
  }
  host.replaceChildren()
  const cols: HTMLElement[] = []
  const cells: HTMLElement[] = []
  chars.forEach((ch, idx) => {
    if (!/\d/.test(ch)) {
      host.append(Object.assign(document.createElement('span'), { className: styles.odoStatic, textContent: ch }))
      return
    }
    const col = document.createElement('span')
    col.className = styles.odoCol
    col.style.setProperty('--d', String(chars.length - 1 - idx)) // the rightmost digit moves first
    // digits 0-9 are drawn by CSS (::before), so the page text holds only the real value (in the sr-only label)
    const cell = document.createElement('span')
    cell.className = styles.odoCell
    cell.style.setProperty('--d', String(chars.length - 1 - idx))
    cell.append(col)
    host.append(cell)
    place(cell, col, Number(ch))
    cols.push(col)
    cells.push(cell)
  })
  return { key, cols, cells }
}

const digitWidthCache = new Map<string, number[]>()
function digitWidths(host: HTMLElement): number[] {
  const cs = getComputedStyle(host)
  const k = `${cs.fontFamily}|${cs.fontSize}`
  const hit = digitWidthCache.get(k)
  if (hit) return hit
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit'
  host.append(probe)
  const w = Array.from({ length: 10 }, (_, d) => { probe.textContent = String(d); return probe.getBoundingClientRect().width })
  probe.remove()
  if (w.every((x) => x > 0)) digitWidthCache.set(k, w)
  return w
}

/** Masked swap: the old word slides up and out while the new one rises in. */
function swapWord(mask: HTMLElement, text: string, animate: boolean) {
  for (const old of Array.from(mask.children) as HTMLElement[]) {
    gsap.killTweensOf(old)
    gsap.to(old, { yPercent: -100, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => old.remove() })
  }
  const next = Object.assign(document.createElement('span'), { className: styles.wordItem, textContent: text })
  mask.append(next)
  if (animate) gsap.fromTo(next, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' })
}

/** Draws a bitmap to cover the canvas, scaled by `scale` about the centre. */
function cover(ctx: CanvasRenderingContext2D, img: ImageBitmap, W: number, H: number, scale: number) {
  const k = Math.max(W / img.width, H / img.height) * scale
  ctx.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k)
}

/** The nearest loaded frame stands in while its neighbours are still downloading. */
function nearestLoaded(list: (ImageBitmap | undefined)[], i: number): ImageBitmap | undefined {
  for (let d = 0; d < list.length; d++) {
    if (list[i - d]) return list[i - d]
    if (list[i + d]) return list[i + d]
  }
  return undefined
}

const idle = () =>
  new Promise<void>((resolve) => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 1000 })
    else setTimeout(resolve, 200)
  })

function Intro() {
  return (
    <>
      <h1 id={TITLE_ID} className={styles.title}>
        <span className={styles.line}>
          <span className={styles.lineInner} data-mirror-line>See the real size,</span>
        </span>
        <span className={styles.line}>
          <span className={styles.lineInner} data-mirror-line>on you.</span>
        </span>
      </h1>
      <p className={styles.lede}>Earrings, necklaces, rings and watches, measured on a real body.</p>
      <div className={styles.actions}>
        <Link href="/try-on/gilded-teardrop?sample=1" className={styles.cta}>
          Try it on
        </Link>
        <Link href="/collection" className={`link-draw ${styles.textLink}`}>
          Browse the collection
        </Link>
      </div>
    </>
  )
}

/** Reduced motion or a short viewport: each chapter as a plain frame with a size slider. */
function StaticMirror() {
  const [picked, setPicked] = useState<number[]>(() => MIRROR.map(() => 0))
  return (
    <section data-testid="mirror-hero" aria-labelledby={TITLE_ID} className={styles.root}>
      <div className={styles.intro}>
        <Intro />
      </div>
      <div className={styles.staticList}>
        {MIRROR.map((c, ci) => {
          const i = picked[ci]
          const label = c.frames[i].label
          return (
            <div key={c.id} className={styles.staticItem}>
              <h2 className={styles.staticTitle}>{c.title}</h2>
              {/* eslint-disable-next-line @next/next/no-img-element -- WebP frame, swapped instantly by the slider */}
              <img
                className={styles.staticImg}
                src={frameSrc(c, i, 'l')}
                alt={`${c.title}: ${label}`}
                width={960}
                height={1200}
                loading={ci === 0 ? 'eager' : 'lazy'}
              />
              <p className={styles.staticLabel}>
                {c.measure}: {label}
              </p>
              <input
                type="range"
                className={styles.range}
                min={0}
                max={c.frames.length - 1}
                step={1}
                value={i}
                aria-label={`${c.title} size`}
                aria-valuetext={label}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setPicked((prev) => prev.map((v, k) => (k === ci ? next : v)))
                }}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Pinned desktop or compact layout. Per-frame state is written imperatively from one ticker callback. */
function PinnedMirror({ layout }: { layout: Layout }) {
  const vertical = layout === 'desktop'
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tapeRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const wordRef = useRef<HTMLSpanElement>(null)
  const aboutRef = useRef<HTMLSpanElement>(null)
  const unitRef = useRef<HTMLSpanElement>(null)
  const odoRef = useRef<HTMLSpanElement>(null)
  const srRef = useRef<HTMLSpanElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const progRef = useRef<(HTMLSpanElement | null)[]>([])
  const [hint, setHint] = useState(true)

  useLayoutEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    const frame = frameRef.current
    const canvas = canvasRef.current
    const tapeClip = tapeRef.current
    const knob = knobRef.current
    const bar = barRef.current
    const word = wordRef.current
    const about = aboutRef.current
    const unit = unitRef.current
    const odo = odoRef.current
    const sr = srRef.current
    if (!root || !stage || !frame || !canvas || !tapeClip || !knob || !bar || !word || !about || !unit || !odo || !sr) {
      return
    }
    // Mounted for the wrong viewport: the outer component swaps in the right layout first.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (modeFor(window.innerWidth, window.innerHeight, reduce) !== layout) return

    gsap.registerPlugin(ScrollTrigger)
    const ctx2d = canvas.getContext('2d')
    if (ctx2d) ctx2d.imageSmoothingQuality = 'high'

    // ?heroP=0..1 freezes the sequence at one progress value, for screenshots.
    const heroP = new URLSearchParams(window.location.search).get('heroP')
    let forcedP: number | null =
      heroP !== null && Number.isFinite(Number(heroP)) ? clamp(Number(heroP), 0, 1) : null

    let used = false
    try {
      used = sessionStorage.getItem(HINT_KEY) === '1'
    } catch {
      used = false
    }
    if (used) setHint(false)

    let alive = true
    let progress = 0
    let st: ScrollTrigger | null = null
    let override: Override | null = null
    let drag: Drag | null = null
    let chapterNow = -1
    let nearNow = -1
    let lastPos = 0
    let metrics = { w: 0, h: 0 }
    let tape: SVGSVGElement | null = null
    let tapeKey = ''
    let tickKey = ''
    let paintKey = ''
    let odoState: Odometer | null = null
    let loadVersion = 0
    const bitmaps: (ImageBitmap | undefined)[][] = MIRROR.map((c) => new Array<ImageBitmap | undefined>(c.frames.length))
    const abort = new AbortController()
    const disposers: (() => void)[] = []
    const onEvent = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) => {
      const handler = fn as EventListener
      target.addEventListener(type, handler)
      disposers.push(() => target.removeEventListener(type, handler))
    }

    const placeBar = (i: number) => {
      const btn = btnRefs.current[i]
      if (btn) bar.style.transform = `translateX(${btn.offsetLeft}px) scaleX(${btn.offsetWidth})`
    }

    const placeProgress = (p: number) => {
      progRef.current.forEach((seg, i) => {
        if (seg) seg.style.transform = `scaleX(${clamp(p * N - i, 0, 1)})`
      })
    }

    const showFrame = (ci: number, near: number) => {
      const c = MIRROR[ci]
      const label = c.frames[near].label
      const parsed = parseLabel(label)
      about.hidden = parsed.prefix !== 'about'
      unit.textContent = parsed.unit || c.unit
      odoState = setNumber(odo, parsed.number, odoState)
      sr.textContent = `${c.measure}: ${label}`
      frame.setAttribute('data-mirror-chapter', String(ci))
      frame.setAttribute('data-mirror-frame', String(near))
      knob.setAttribute('aria-valuenow', String(near))
      knob.setAttribute('aria-valuetext', label)
    }

    const enterChapter = (ci: number) => {
      const c = MIRROR[ci]
      swapWord(word, c.measure, chapterNow >= 0)
      placeBar(ci)
      btnRefs.current.forEach((b, k) => b?.setAttribute('aria-current', String(k === ci)))
      knob.setAttribute('aria-label', `${c.title} size`)
      knob.setAttribute('aria-valuemax', String(c.frames.length - 1))
      if (override && override.chapter !== ci) override = null // overrides never carry across chapters
      chapterNow = ci
    }

    const tapeCache = new Map<string, SVGSVGElement>()
    const placeTape = (c: MirrorChapter, ppm: number, len: number, value: number) => {
      const key = `${c.id}|${ppm.toFixed(3)}|${len}`
      if (!tape || key !== tapeKey) {
        tapeKey = key
        // Tapes are built once per chapter and size, then reused: rebuilding ~500 SVG ticks on every
        // chapter change was a 50 ms task on a 4x-throttled CPU.
        let t = tapeCache.get(key)
        if (!t) { t = buildTape(c, ppm, vertical, len); tapeCache.set(key, t) }
        tape = t
        tapeClip.replaceChildren(tape)
      }
      // The tick for the current size sits under the handle, at the middle of the ruler.
      const at = len / 2 - rulerOffsetPx(value, c.unit, ppm)
      tape.style.transform = vertical ? `translate3d(0, ${at}px, 0)` : `translate3d(${at}px, 0, 0)`
    }

    const paint = (ci: number, pos: number, transition: number) => {
      if (!ctx2d || metrics.w === 0) return
      const list = bitmaps[ci]
      const mix = blend(pos)
      const A = nearestLoaded(list, mix.a)
      if (!A) return
      const key = `${ci}|${pos.toFixed(3)}|${transition.toFixed(3)}|${canvas.width}x${canvas.height}|${loadVersion}`
      if (key === paintKey) return
      paintKey = key
      const B = nearestLoaded(list, mix.b)
      const incoming = transition > 0 && ci + 1 < N ? bitmaps[ci + 1][0] : undefined
      const W = canvas.width
      const H = canvas.height
      ctx2d.globalAlpha = 1
      cover(ctx2d, A, W, H, 1)
      if (B && mix.t > 0.001) {
        ctx2d.globalAlpha = mix.t
        cover(ctx2d, B, W, H, 1)
        ctx2d.globalAlpha = 1
      }
      if (incoming) {
        // The next chapter's first frame wipes up from the bottom as the cross-fade begins.
        ctx2d.save()
        ctx2d.beginPath()
        ctx2d.rect(0, H * (1 - transition), W, H * transition)
        ctx2d.clip()
        cover(ctx2d, incoming, W, H, 1.04 - 0.04 * transition)
        ctx2d.restore()
        // A gold edge rides the wipe, like the ruler's own line sweeping across the mirror.
        if (transition < 0.995) {
          const edge = Math.max(2, Math.round(2 * (W / Math.max(1, metrics.w))))
          ctx2d.fillStyle = '#B08A3E'
          ctx2d.fillRect(0, Math.round(H * (1 - transition)) - edge / 2, W, edge)
        }
      }
      canvas.dataset.ready = 'true'
    }

    const tick = () => {
      if (!alive || metrics.w === 0) return
      const p = forcedP ?? progress
      if (override && Math.abs(p - override.p0) > 0.001) override = null // scrolling takes back control
      const { chapter: ci, local, transition } = chapterAt(p, N)
      const c = MIRROR[ci]
      const count = c.frames.length
      const pos = override && override.chapter === ci ? override.pos : framePos(local, count)
      const key = `${ci}|${pos.toFixed(3)}|${transition.toFixed(3)}|${loadVersion}|${metrics.w}x${metrics.h}`
      if (key === tickKey) return
      tickKey = key
      lastPos = pos

      const changed = ci !== chapterNow
      if (changed) enterChapter(ci)
      const near = nearestFrame(pos, count)
      if (changed || near !== nearNow) {
        nearNow = near
        showFrame(ci, near)
        placeProgress(p)
      }

      const mix = blend(pos)
      const lo = c.frames[clamp(mix.a, 0, count - 1)].measured
      const hi = c.frames[clamp(mix.b, 0, count - 1)].measured
      placeTape(c, (c.pxPerMmAt960 * metrics.w) / 960, vertical ? metrics.h : metrics.w, lo + (hi - lo) * mix.t)
      paint(ci, pos, transition)
    }

    const measure = () => {
      const w = frame.clientWidth
      const h = frame.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      metrics = { w, h }
      const cw = Math.max(1, Math.round(w * dpr))
      const ch = Math.max(1, Math.round(h * dpr))
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }
      tapeKey = ''
      tickKey = ''
      paintKey = ''
      if (chapterNow >= 0) placeBar(chapterNow)
    }

    const markUsed = () => {
      if (used) return
      used = true
      try {
        sessionStorage.setItem(HINT_KEY, '1')
      } catch {
        // Private mode: the hint shows again on the next visit.
      }
      setHint(false)
    }

    const beginDrag = (e: PointerEvent) => {
      if ((e.pointerType === 'mouse' && e.button !== 0) || chapterNow < 0) return
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      if (override) gsap.killTweensOf(override)
      override = { chapter: chapterNow, pos: lastPos, p0: forcedP ?? progress }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: lastPos }
      markUsed()
    }

    const moveDrag = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId || !override) return
      // Dragging up (vertical) or right (horizontal) makes the size grow.
      const steps = vertical ? (drag.y - e.clientY) / DRAG_PX : (e.clientX - drag.x) / DRAG_PX
      override.pos = clamp(drag.start + steps, 0, MIRROR[override.chapter].frames.length - 1)
    }

    const endDrag = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return
      drag = null
      const el = e.currentTarget as HTMLElement
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      if (!override) return
      const target = nearestFrame(override.pos, MIRROR[override.chapter].frames.length)
      gsap.to(override, { pos: target, duration: 0.35, ease: 'expo.out' })
    }

    const onKey = (e: KeyboardEvent) => {
      if (chapterNow < 0) return
      const ci = chapterNow
      const count = MIRROR[ci].frames.length
      const cur = nearestFrame(override && override.chapter === ci ? override.pos : lastPos, count)
      let next: number
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          next = cur + 1
          break
        case 'ArrowDown':
        case 'ArrowLeft':
          next = cur - 1
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = count - 1
          break
        default:
          return
      }
      e.preventDefault()
      if (override) gsap.killTweensOf(override)
      override = { chapter: ci, pos: clamp(next, 0, count - 1), p0: forcedP ?? progress }
      markUsed()
    }

    const goTo = (i: number) => {
      const target = progressForChapterStart(i, N)
      if (st) scrollToY(st.start + target * (st.end - st.start))
      else if (forcedP !== null) forcedP = target
    }

    measure()
    const size: 'l' | 's' = metrics.w >= 520 ? 'l' : 's' // the frame's width decides which WebP to fetch
    const ro = new ResizeObserver(() => {
      measure()
      tick()
    })
    ro.observe(frame)

    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72
    const ctx = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll('[data-mirror-line]'),
        { yPercent: 110, opacity: 0, filter: 'blur(6px)' },
        { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', stagger: 0.09 },
      )
      if (forcedP !== null) return
      st = ScrollTrigger.create({
        trigger: stage,
        start: `top top+=${headerH}`,
        end: `+=${N * 65}%`, // about 2.6 screens: each one changes the photo, the ruler and the number
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          progress = self.progress
        },
      })
      progress = st.progress
    }, root)

    for (const el of [knob, canvas]) {
      onEvent<PointerEvent>(el, 'pointerdown', beginDrag)
      onEvent<PointerEvent>(el, 'pointermove', moveDrag)
      onEvent<PointerEvent>(el, 'pointerup', endDrag)
      onEvent<PointerEvent>(el, 'pointercancel', endDrag)
    }
    onEvent<KeyboardEvent>(knob, 'keydown', onKey)
    btnRefs.current.forEach((btn, i) => {
      if (btn) onEvent<MouseEvent>(btn, 'click', () => goTo(i))
    })

    const loadFrame = async (ci: number, i: number) => {
      try {
        const res = await fetch(frameSrc(MIRROR[ci], i, size), { signal: abort.signal })
        if (!res.ok) return
        const bmp = await createImageBitmap(await res.blob())
        if (!alive) {
          bmp.close()
          return
        }
        bitmaps[ci][i] = bmp
        loadVersion++
      } catch {
        // Aborted or failed: the nearest loaded frame stands in.
      }
    }
    // Chapter 0 first, so the stage works at once; the other chapters load while the browser is idle.
    const preload = async () => {
      await Promise.all(MIRROR[0].frames.map((f) => loadFrame(0, f.i)))
      if (!alive) return
      ScrollTrigger.refresh()
      tick()
      for (let ci = 1; ci < N; ci++) {
        await idle()
        if (!alive) return
        await Promise.all(MIRROR[ci].frames.map((f) => loadFrame(ci, f.i)))
      }
    }
    void preload()

    void document.fonts.ready.then(() => {
      if (!alive) return
      ScrollTrigger.refresh()
      measure()
      tick()
    })

    gsap.ticker.add(tick)
    tick()

    return () => {
      alive = false
      abort.abort()
      gsap.ticker.remove(tick)
      ro.disconnect()
      disposers.forEach((dispose) => dispose())
      ctx.revert()
      if (override) gsap.killTweensOf(override)
      gsap.killTweensOf(Array.from(word.children))
      bitmaps.flat().forEach((bmp) => bmp?.close())
    }
  }, [layout, vertical])

  const mirror = (
    <div className={vertical ? styles.mirrorV : styles.mirrorH}>
      <div ref={frameRef} className={styles.frame} data-mirror-chapter={0} data-mirror-frame={0}>
        {/* eslint-disable-next-line @next/next/no-img-element -- preloaded WebP, painted over by the canvas */}
        <img
          className={styles.fill}
          src={frameSrc(MIRROR[0], 0, 'l')}
          alt={`${MIRROR[0].title}: ${MIRROR[0].frames[0].label}`}
          width={960}
          height={1200}
          fetchPriority="high"
        />
        <canvas
          ref={canvasRef}
          className={`${styles.fill} ${vertical ? styles.canvasV : styles.canvasH}`}
          aria-hidden="true"
        />
        <div className={vertical ? styles.rulerV : styles.rulerH}>
          <div ref={tapeRef} className={styles.tapeClip} aria-hidden="true" />
          <div className={vertical ? styles.handleV : styles.handleH}>
            <span className={styles.handleLine} aria-hidden="true" />
            <div
              ref={knobRef}
              role="slider"
              tabIndex={0}
              className={styles.knob}
              aria-label={`${MIRROR[0].title} size`}
              aria-orientation={vertical ? 'vertical' : 'horizontal'}
              aria-valuemin={0}
              aria-valuemax={MIRROR[0].frames.length - 1}
              aria-valuenow={0}
            >
              <svg viewBox="0 0 28 28" className={styles.knobIcon} aria-hidden="true">
                {vertical ? (
                  <>
                    <path d="M10 12.5l4-4 4 4" />
                    <path d="M10 15.5l4 4 4-4" />
                  </>
                ) : (
                  <>
                    <path d="M12.5 10l-4 4 4 4" />
                    <path d="M15.5 10l4 4-4 4" />
                  </>
                )}
              </svg>
            </div>
            {hint && (
              <span className={vertical ? styles.hintV : styles.hintH} aria-hidden="true">
                <svg viewBox="0 0 12 12" className={styles.chevA}>
                  <path d={vertical ? 'M1 8l5-5 5 5' : 'M8 1L3 6l5 5'} />
                </svg>
                <svg viewBox="0 0 12 12" className={styles.chevB}>
                  <path d={vertical ? 'M1 4l5 5 5-5' : 'M4 1l5 5-5 5'} />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className={styles.progress} aria-hidden="true">
        {MIRROR.map((c, i) => (
          <span key={c.id} className={styles.progSeg}>
            <span
              ref={(el) => {
                progRef.current[i] = el
              }}
              className={styles.progFill}
            />
          </span>
        ))}
      </div>
    </div>
  )

  const index = (
    <nav aria-label="Jewellery types" className={styles.indexNav}>
      <div className={styles.index}>
        {MIRROR.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => {
              btnRefs.current[i] = el
            }}
            type="button"
            className={styles.indexBtn}
          >
            {c.title}
          </button>
        ))}
        <span ref={barRef} className={styles.indexBar} aria-hidden="true" />
      </div>
    </nav>
  )

  const readout = (
    <div className={styles.readout} aria-hidden="true" data-ui="">
      <p className={styles.measure}>
        <span ref={wordRef} className={styles.wordMask} />
      </p>
      <p className={styles.value}>
        <span ref={aboutRef} className={styles.about} hidden>
          about
        </span>
        <span ref={odoRef} className={styles.odo} />
        <span ref={unitRef} className={styles.unit} />
      </p>
    </div>
  )

  if (vertical) {
    return (
      <section ref={rootRef} data-testid="mirror-hero" aria-labelledby={TITLE_ID} className={styles.root}>
        <div ref={stageRef} className={`${styles.stage} ${styles.stageDesktop}`}>
          <div className={styles.copy}>
            <Intro />
            {index}
            {readout}
          </div>
          <div className={styles.cell}>{mirror}</div>
        </div>
        <span ref={srRef} className={styles.srOnly} />
      </section>
    )
  }

  return (
    <section ref={rootRef} data-testid="mirror-hero" aria-labelledby={TITLE_ID} className={styles.root}>
      <div className={styles.intro}>
        <Intro />
      </div>
      <div ref={stageRef} className={`${styles.stage} ${styles.stageCompact}`}>
        {mirror}
        {index}
        {readout}
      </div>
      <span ref={srRef} className={styles.srOnly} />
    </section>
  )
}

export function MirrorHero() {
  // The server render and the first client render use the desktop layout. The effect below
  // corrects it before paint for other viewports.
  const [mode, setMode] = useState<Mode>('desktop')

  useLayoutEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setMode(modeFor(window.innerWidth, window.innerHeight, motion.matches))
    update()
    window.addEventListener('resize', update)
    motion.addEventListener('change', update)
    return () => {
      window.removeEventListener('resize', update)
      motion.removeEventListener('change', update)
    }
  }, [])

  // Keyed on mode, so a layout change remounts with the old pin already torn down.
  return mode === 'static' ? <StaticMirror /> : <PinnedMirror key={mode} layout={mode} />
}
