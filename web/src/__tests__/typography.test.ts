import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')
const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

describe('typography system', () => {
  it('loads the requested display and sans font variables', () => {
    expect(layout).toContain("import { Gloock, Hanken_Grotesk } from 'next/font/google'")
    expect(layout).toContain("weight: '400'")
    expect(layout).toContain("variable: '--font-display'")
    expect(layout).toContain("variable: '--font-sans'")
    expect(layout).not.toContain('Instrument')
    expect(layout).not.toContain('--font-gloock')
    expect(layout).not.toContain('--font-hanken-grotesk')
  })

  it('applies the shared body and display metrics', () => {
    expect(globals).toContain('font-family: var(--font-sans);')
    expect(globals).toContain('font-size: 16px;')
    expect(globals).toContain('line-height: 1.5;')
    expect(globals).toContain('h1, h2, h3,')
    expect(globals).toContain('.font-display,')
    expect(globals).toContain('.font-serif {')
    expect(globals).toContain('font-family: var(--font-display);')
    expect(globals).toContain('letter-spacing: -0.02em !important;')
    expect(globals).toContain('line-height: 1 !important;')
  })
})
