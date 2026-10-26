import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { HowSlip, buildSlipClipPath } from '@/components/home/HowSlip'
import { ClosingCta } from '@/components/home/ClosingCta'
import { ClipReveal, PrintRows, Reveal, RevealLines, groupByLine, splitWords } from '@/components/motion/Reveal'

describe('HowSlip', () => {
  const html = renderToStaticMarkup(<HowSlip />)

  it('renders three steps and the closing bar as four rows', () => {
    expect(html.split('data-row').length - 1).toBe(4)
  })

  it('shows the three step times and the closing time', () => {
    expect(html).toContain('>10 s<')
    expect(html).toContain('>2 s<')
    expect(html).toContain('>about 10 s<')
    expect(html).toContain('>under 1 min<')
  })

  it('labels the section with its heading, which keeps the full text as its accessible name', () => {
    expect(html).toContain('aria-label="Three steps. About a minute."')
    expect(html).toContain('<span class="word">Three</span> <span class="word">steps.</span>')
  })

  it('links to the sizing explainer', () => {
    expect(html).toContain('href="/how-it-works"')
  })

  it('clips the slip with a zig-zag bottom edge of 12px teeth', () => {
    const path = buildSlipClipPath()
    expect(path.startsWith('polygon(0% 0%, 100% 0%, 100% calc(100% - 12px), 97.273% 100%, ')).toBe(true)
    expect(path.endsWith('0% 100%)')).toBe(true)
  })
})

describe('ClosingCta', () => {
  const html = renderToStaticMarkup(<ClosingCta />)

  it('links the button to the gilded teardrop try-on', () => {
    expect(html).toContain('href="/try-on/gilded-teardrop?sample=1"')
    expect(html).toContain('>Try it on<')
  })

  it('shows the sample earring photo with alt text and lazy loading', () => {
    expect(html).toContain('src="/mirror/closing.webp"')
    expect(html).toContain('alt="Gold teardrop earring worn on the sample face"')
    expect(html).toContain('loading="lazy"')
  })
})

describe('RevealLines', () => {
  it('exposes the full text as the accessible name', () => {
    const html = renderToStaticMarkup(<RevealLines text="Your photo next." />)
    expect(html).toContain('aria-label="Your photo next."')
    expect(html).toContain('<span class="word">Your</span> <span class="word">photo</span> <span class="word">next.</span>')
  })

  it('escapes markup characters inside the words', () => {
    const html = renderToStaticMarkup(<RevealLines text="Tom & <Jerry>" />)
    expect(html).toContain('<span class="word">&amp;</span>')
    expect(html).toContain('<span class="word">&lt;Jerry&gt;</span>')
  })
})

describe('motion helpers', () => {
  it('splits copy into words on any whitespace', () => {
    expect(splitWords('  Three steps.\n About  a minute. ')).toEqual(['Three', 'steps.', 'About', 'a', 'minute.'])
    expect(splitWords('   ')).toEqual([])
  })

  it('groups words into lines by top offset, tolerating a 1px rounding difference', () => {
    const lines = groupByLine([
      { item: 'Three', top: 0 },
      { item: 'steps.', top: 0 },
      { item: 'About', top: 68 },
      { item: 'minute.', top: 69 },
    ])
    expect(lines).toEqual([
      ['Three', 'steps.'],
      ['About', 'minute.'],
    ])
  })

  it('renders reveal wrappers with their content in the server markup and no hidden starting styles', () => {
    const html = renderToStaticMarkup(
      <>
        <Reveal>
          <p data-reveal="">Alpha</p>
        </Reveal>
        <ClipReveal>
          <span>Beta</span>
        </ClipReveal>
        <PrintRows as="ul">
          <li data-row="">Gamma</li>
        </PrintRows>
      </>,
    )
    expect(html).toContain('Alpha')
    expect(html).toContain('Beta')
    expect(html).toContain('Gamma')
    expect(html).not.toContain('clip-path')
    expect(html).not.toContain('opacity')
  })
})
