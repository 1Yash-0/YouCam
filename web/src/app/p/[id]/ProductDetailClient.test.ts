import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./ProductDetailClient.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./ProductDetail.module.css', import.meta.url), 'utf8')

describe('ProductDetailClient factual UI guardrails', () => {
  it('defines contrasting selected and unselected size states on the gold ruler', () => {
    expect(source).toContain('aria-pressed={size === value}')
    expect(source).toContain('className={styles.disc}')
    expect(css).toContain(".sizeButton[aria-pressed='true']")
    expect(css).toContain('transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1);')
  })

  it('uses the collection breadcrumb and removes the mobile sticky bar', () => {
    expect(source).toContain('<Link href="/collection"')
    expect(source).toContain('Collection')
    expect(source).not.toContain('ATELIER')
    expect(source).not.toContain('Mobile Sticky Bottom Action Bar')
    expect(source).not.toContain('fixed bottom-0')
  })

  it('uses current demo-catalogue and saved-choice copy without implying checkout', () => {
    expect(source).toContain('>Try it on</button>')
    expect(source).toContain('>Save</button>')
    expect(source).toContain('Demonstration catalogue')
    expect(source).toContain('illustrative price')
    expect(source).toContain('These reference pieces are not offered for sale here.')

    for (const staleClaim of [
      'INCLUSIVE OF ALL TAXES',
      '925 sterling silver',
      'Nickel-safe',
      'hypoallergenic',
      'anti-tarnish',
      'microscopic shield',
      'Hand-buffed',
      'Estimated weight',
      'Free express insured delivery',
      'Free size exchange within 14 days.',
      'PROCEED TO CHECKOUT',
      'Add to bag',
      'Try this piece',
      'Save this piece',
    ]) {
      expect(source).not.toContain(staleClaim)
    }
  })

  it('keeps measured dimensions while hiding generated image metadata and necklace caveats', () => {
    expect(source).toContain('const hasGeneratedImage = product.source.startsWith')
    expect(source).toContain("const credit = hasGeneratedImage ? '' : getProductSourceCredit(product)")
    expect(source).toContain('!hasGeneratedImage && !credit.includes(product.licence)')
    expect(source).toContain("product.type !== 'necklace'")
    expect(source).toContain('{c.dimensionLabel}')
    expect(source).toContain('Details and credits')
  })

  it('keeps the 7/12 gallery, 5/12 sticky buying panel and the 4:5 frame', () => {
    expect(css).toContain('grid-column: 1 / span 7;')
    expect(css).toContain('grid-column: 8 / span 5;')
    expect(css).toContain('top: calc(var(--header-h) + 32px);')
    expect(css).toContain('aspect-ratio: 4 / 5;')
  })

  it('crossfades gallery images over 300ms and settles the incoming frame from 1.03 over 600ms', () => {
    expect(css).toContain('transition: opacity 300ms ease;')
    expect(css).toContain('animation: settle 600ms cubic-bezier(0.16, 1, 0.3, 1);')
    expect(css).toContain('transform: scale(1.03);')
  })

  it('labels both gallery thumbnails and marks the selected one with aria-pressed', () => {
    expect(source).toContain("aria-pressed={activeView === 'worn'}")
    expect(source).toContain("aria-pressed={activeView === 'cutout'}")
    expect(source).toContain('aria-label="Sample preview"')
    expect(source).toContain('aria-label="Product image"')
    expect(css).toContain('width: 88px;')
    expect(css).toContain('height: 88px;')
  })
})
