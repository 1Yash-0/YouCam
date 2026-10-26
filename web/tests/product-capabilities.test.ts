import { describe, it, expect } from 'vitest'
import { getProductCapabilities, selectionLabel } from '../src/lib/product-capabilities'
import products from '../data/products.json'
import type { Product } from '../src/lib/products'

describe('category controls', () => {
  for (const product of products as Product[]) {
    it(`${product.id} exposes only compatible sizing and photos`, () => {
      const c = getProductCapabilities(product)
      if (product.type === 'single' || product.type === 'stud') {
        expect(c.flow).toBe('ear'); expect(c.calibration).toBe(true); expect(c.sizes.length).toBeGreaterThan(0)
      } else if (product.type === 'necklace') {
        expect(c.flow).toBe('neck'); expect(c.sizes).toEqual([]); expect(c.photoKind).toBe('portrait')
      } else if (product.type !== 'garment') {
        expect(c.flow).toBe('hand'); expect(c.styling).toBe(false); expect(c.calibration).toBe(false)
        expect(selectionLabel(product, 0.4)).not.toContain('cm drop')
      }
    })
  }
})
