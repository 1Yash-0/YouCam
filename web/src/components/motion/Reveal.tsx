'use client'

import React, { useEffect, useLayoutEffect, useMemo, useRef, type ElementType } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** True when the visitor has asked for reduced motion. Every reveal then leaves its content as rendered. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  )
}

let scrollTriggerRegistered = false

/** Registers the ScrollTrigger plugin once, the first time a reveal runs in the browser. */
export function registerScrollTrigger(): void {
  if (scrollTriggerRegistered) return
  gsap.registerPlugin(ScrollTrigger)
  scrollTriggerRegistered = true
}

// Layout effects run before paint, so hidden starting states are applied before the first frame.
// On the server there is no DOM, so this resolves to useEffect, which never runs during SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Splits copy into words on any run of whitespace. */
export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

/**
 * Groups items into visual lines by their vertical offset. An item whose top is within `tolerance`
 * px of the current line's top joins that line, which absorbs sub-pixel rounding in offsetTop.
 */
export function groupByLine<T>(items: ReadonlyArray<{ item: T; top: number }>, tolerance = 2): T[][] {
  const lines: T[][] = []
  let lineTop = 0
  items.forEach(({ item, top }, index) => {
    if (index === 0 || Math.abs(top - lineTop) > tolerance) {
      lines.push([])
      lineTop = top
    }
    lines[lines.length - 1].push(item)
  })
  return lines
}

// Server markup: one span per word, separated by spaces, so the heading reads before any JavaScript runs.
function wordsMarkup(words: string[]): string {
  return words
    .map((word) => `<span class="word">${word.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch])}</span>`)
    .join(' ')
}

function createWordNode(word: string): HTMLSpanElement {
  const node = document.createElement('span')
  node.className = 'word'
  node.textContent = word
  return node
}

// Interleaves single spaces between word nodes so each line still reads as a sentence.
function withSpaces(nodes: HTMLElement[]): Array<HTMLElement | string> {
  return nodes.flatMap((node, index) => (index === 0 ? [node] : [' ', node]))
}

// One visual line: a clipping mask around a block that starts pushed below it. The vertical padding
// gives ascenders and descenders room inside the clip, and the matching negative margin leaves line spacing unchanged.
function createLineMask(nodes: HTMLElement[]): HTMLSpanElement {
  const mask = document.createElement('span')
  mask.setAttribute('aria-hidden', 'true')
  mask.style.cssText = 'display:block;overflow:hidden;overflow:clip;padding:0.08em 0 0.12em;margin:-0.08em 0 -0.12em'
  const line = document.createElement('span')
  line.setAttribute('data-line', '')
  line.style.display = 'block'
  line.append(...withSpaces(nodes))
  mask.append(line)
  return mask
}

export interface RevealLinesProps {
  text: string
  as?: ElementType
  className?: string
  id?: string
}

/**
 * Heading whose lines rise out of a mask, one after another, when it reaches 85% of the viewport.
 * The server markup is plain words with an aria-label, so the text is visible before JavaScript runs.
 */
export function RevealLines({ as = 'h2', text, className, id }: RevealLinesProps) {
  const Tag = as
  const ref = useRef<HTMLElement | null>(null)
  const markup = useMemo(() => wordsMarkup(splitWords(text)), [text])

  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    registerScrollTrigger()

    const words = splitWords(text)
    let ctx: ReturnType<typeof gsap.context> | null = null
    let revealed = false
    let disposed = false
    let resizeTimer = 0

    // Rebuilds the line masks at the current width. Words are measured on a flat rebuild, so the wrap is exact.
    const split = () => {
      if (disposed || revealed) return
      ctx?.revert()
      ctx = null

      const wordNodes = words.map(createWordNode)
      el.replaceChildren(...withSpaces(wordNodes))
      const lines = groupByLine(wordNodes.map((node) => ({ item: node, top: node.offsetTop })))
      el.replaceChildren(...lines.map((line) => createLineMask(line)))

      const lineNodes = Array.from(el.querySelectorAll<HTMLElement>('[data-line]'))
      if (lineNodes.length === 0) return
      ctx = gsap.context(() => {
        gsap.fromTo(
          lineNodes,
          { yPercent: 110, filter: 'blur(6px)', opacity: 0 },
          {
            yPercent: 0,
            filter: 'blur(0px)',
            opacity: 1,
            duration: 0.9,
            ease: 'expo.out',
            stagger: 0.09,
            clearProps: 'filter,transform',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              once: true,
              onEnter: () => {
                revealed = true
              },
            },
          },
        )
      }, el)
    }

    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(split, 150)
    }

    window.addEventListener('resize', onResize)
    // Measure only once this heading's own face is loaded. fonts.ready alone can resolve before the
    // display face starts loading, and a fallback-font measurement would clip wrapped lines inside their masks.
    const style = window.getComputedStyle(el)
    const fontsReady = document.fonts
      ? document.fonts
          .load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, text)
          .then(() => document.fonts.ready)
          .catch(() => undefined)
      : Promise.resolve()
    void fontsReady.then(split)

    return () => {
      disposed = true
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      ctx?.revert()
      ctx = null
    }
  }, [text])

  return (
    <Tag
      ref={ref}
      id={id}
      className={className}
      aria-label={text}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

export interface RevealProps {
  children: React.ReactNode
  className?: string
  as?: ElementType
}

/** Lifts and fades every [data-reveal] descendant in once, staggered, when the block reaches 85% of the viewport. */
export function Reveal({ children, className, as = 'div' }: RevealProps) {
  const Tag = as
  const ref = useRef<HTMLElement | null>(null)

  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    registerScrollTrigger()

    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (targets.length === 0) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { y: 24, opacity: 0, filter: 'blur(6px)' },
        {
          y: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: 0.8,
          ease: 'expo.out',
          stagger: 0.07,
          clearProps: 'filter,transform',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        },
      )
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}

export interface ClipRevealProps {
  children: React.ReactNode
  className?: string
}

/** Opens its box from the top edge downward, and settles its first image from scale 1.08 to 1. */
export function ClipReveal({ children, className }: ClipRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    registerScrollTrigger()

    const img = el.querySelector<HTMLImageElement>('img')
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { clipPath: 'inset(0% 0% 100% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 1.2,
          ease: 'power4.inOut',
          clearProps: 'clipPath',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        },
      )
      if (img) {
        gsap.fromTo(
          img,
          { scale: 1.08 },
          {
            scale: 1,
            duration: 1.6,
            ease: 'expo.out',
            clearProps: 'transform',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          },
        )
      }
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className={className} style={{ overflow: 'clip' }}>
      {children}
    </div>
  )
}

export interface PrintRowsProps {
  children: React.ReactNode
  className?: string
  as?: ElementType
}

/** Prints each [data-row] in from the left, one after another, when the list reaches 80% of the viewport. */
export function PrintRows({ children, className, as = 'div' }: PrintRowsProps) {
  const Tag = as
  const ref = useRef<HTMLElement | null>(null)

  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    registerScrollTrigger()

    const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-row]'))
    if (rows.length === 0) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        rows,
        { clipPath: 'inset(0% 100% 0% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.6,
          ease: 'power3.out',
          stagger: 0.12,
          clearProps: 'clipPath',
          scrollTrigger: { trigger: el, start: 'top 80%', once: true },
        },
      )
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}
