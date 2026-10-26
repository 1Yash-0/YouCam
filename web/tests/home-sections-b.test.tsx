import fs from 'fs'
import path from 'path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LooksFrame, advanceLookStep } from '@/components/home/LooksFrame'
import { WORN_IMAGE_MAP } from '@/components/home/ProductCard'
import { ShopByBody, buildShopTabs, nextTabIndex } from '@/components/home/ShopByBody'
import { ProductSchema, type Product } from '@/lib/products'

// The real catalogue, parsed with the same schema tests/catalogue.test.ts uses.
const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'products.json'), 'utf-8')) as unknown[]
const products: Product[] = raw.map((item) => ProductSchema.parse(item))
const jewellery = products.filter((product) => product.type !== 'garment')
const tabs = buildShopTabs(products)

function countOf(html: string, needle: string): number {
  return html.split(needle).length - 1
}

describe('buildShopTabs', () => {
  it('makes one tab per category, in display order, and gives garments no tab', () => {
    expect(tabs.map((tab) => tab.label)).toEqual(['Earrings', 'Necklaces', 'Rings', 'Bracelets', 'Watches'])
    expect(tabs.flatMap((tab) => tab.products).some((product) => product.type === 'garment')).toBe(false)
  })

  it('puts every jewellery product in exactly one tab', () => {
    const ids = tabs.flatMap((tab) => tab.products.map((product) => product.id)).sort()
    expect(ids).toEqual(jewellery.map((product) => product.id).sort())
  })
})

describe('nextTabIndex', () => {
  it('moves with the arrow keys, wrapping at both ends, and jumps with Home and End', () => {
    expect(nextTabIndex('ArrowRight', 0, 5)).toBe(1)
    expect(nextTabIndex('ArrowRight', 4, 5)).toBe(0)
    expect(nextTabIndex('ArrowLeft', 0, 5)).toBe(4)
    expect(nextTabIndex('Home', 3, 5)).toBe(0)
    expect(nextTabIndex('End', 1, 5)).toBe(4)
    expect(nextTabIndex('Enter', 1, 5)).toBeNull()
  })
})

describe('ShopByBody', () => {
  const html = renderToStaticMarkup(<ShopByBody products={products} />)

  it('renders a tab for each category that has products', () => {
    expect(countOf(html, 'role="tab"')).toBe(tabs.length)
    for (const tab of tabs) expect(html).toContain(`>${tab.label}</button>`)
  })

  it('omits the tab for a category with no products', () => {
    const withoutRings = renderToStaticMarkup(
      <ShopByBody products={products.filter((product) => product.type !== 'ring')} />,
    )
    expect(countOf(withoutRings, 'role="tab"')).toBe(tabs.length - 1)
    expect(withoutRings).not.toContain('>Rings</button>')
  })

  it('links every product in the first tab to its try-on and product page, even while collapsed', () => {
    for (const product of tabs[0].products) {
      expect(html).toContain(`href="/try-on/${product.id}?sample=1"`)
      expect(html).toContain(`href="/p/${product.id}"`)
    }
  })

  it('renders rows and frame images for the first tab only', () => {
    for (const tab of tabs.slice(1)) {
      for (const product of tab.products) expect(html).not.toContain(`href="/p/${product.id}"`)
    }
    expect(html).toContain(`src="${WORN_IMAGE_MAP['gilded-teardrop']}"`)
    expect(html).not.toContain(`src="${WORN_IMAGE_MAP['orb-chain']}"`)
  })

  it('has a worn preview for every jewellery product', () => {
    for (const product of jewellery) expect(WORN_IMAGE_MAP[product.id], product.id).toBeTruthy()
  })

  it('eagerly loads only the first frame image and lazily loads the rest', () => {
    const firstTabImages = tabs[0].products.filter((product) => WORN_IMAGE_MAP[product.id]).length
    expect(countOf(html, 'loading="eager"')).toBe(1)
    expect(countOf(html, 'loading="lazy"')).toBe(firstTabImages - 1)
  })

  it('names the section by its heading and links to the collection', () => {
    expect(html).toContain('aria-label="Shop by where you wear it."')
    expect(html).toContain('href="/collection"')
    expect(html).toContain('>See all pieces</a>')
  })
})

describe('advanceLookStep', () => {
  it('moves to the next look, wraps after the last, and records the look it left', () => {
    expect(advanceLookStep({ index: 0, previous: null, cycle: 0 }, 3)).toEqual({ index: 1, previous: 0, cycle: 1 })
    expect(advanceLookStep({ index: 2, previous: 1, cycle: 5 }, 3)).toEqual({ index: 0, previous: 2, cycle: 6 })
  })
})

describe('LooksFrame', () => {
  it('renders nothing until the looks have loaded', () => {
    expect(renderToStaticMarkup(<LooksFrame />)).toBe('')
  })
})
