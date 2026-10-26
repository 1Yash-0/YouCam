import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'fs'
import path from 'path'
import { HeroRuler, RULER_WINDOWS, scaleBarPx } from '@/components/home/HeroRuler'

describe('HeroRuler content', () => {
  it('ships every actual frame and matching alternative text', () => {
    for (const window of RULER_WINDOWS) {
      expect(window.labels.length).toBe(window.alt.length)
      window.labels.forEach((_, index) => expect(fs.existsSync(path.join(process.cwd(), 'public', 'hero', 'strip', `${window.id}-${index}.webp`))).toBe(true))
    }
  })
  it('provides all category size choices and the sample action before animation initializes', () => {
    const html = renderToStaticMarkup(React.createElement(HeroRuler))
    for (const window of RULER_WINDOWS) expect(html).toContain(`aria-label="${window.title} size"`)
    expect(html).toContain('4.5 cm')
    expect(html).toContain('/try-on/gilded-teardrop?sample=1')
    expect(html).not.toContain('Pause size preview')
  })
  it('keeps scale bars proportional to the contained source photograph', () => {
    const watch = RULER_WINDOWS.find(window => window.id === 'watch')!
    expect(scaleBarPx(watch, 300, 480)).toBeCloseTo(20 * 5.312 / 560 * 300, 5)
    expect(scaleBarPx(watch, 300, 240)).toBeCloseTo(20 * 5.312 / 560 * 150, 5)
  })
})
