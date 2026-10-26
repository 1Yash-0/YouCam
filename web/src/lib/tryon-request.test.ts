import { describe, expect, it } from 'vitest'
import type { Product } from './products'
import type { StylingExtras } from '@/components/tryon/types'
import { buildTryOnRequest } from './tryon-request'

const products: Record<string, Product> = {
  earring: {
    id: 'ear', name: 'Drop', brand: 'Darpan', type: 'single', heightCm: 4, widthCm: 1,
    metal: 'gold', priceUsd: 89, imagePath: '/e.png', source: 'test', licence: 'test',
  },
  stud: {
    id: 'stud', name: 'Stud', brand: 'Darpan', type: 'stud', heightCm: 0.6, widthCm: 0.6,
    metal: 'silver', priceUsd: 49, imagePath: '/s.png', source: 'test', licence: 'test',
  },
  necklace: {
    id: 'neck', name: 'Chain', brand: 'Darpan', type: 'necklace', lengthCm: 40,
    priceUsd: 120, imagePath: '/n.png', source: 'test', licence: 'test',
  },
  ring: {
    id: 'ring', name: 'Ring', brand: 'Darpan', type: 'ring', diameterMm: 24,
    metal: 'gold', priceUsd: 100, imagePath: '/r.png', source: 'test', licence: 'test',
  },
  bracelet: {
    id: 'bracelet', name: 'Bracelet', brand: 'Darpan', type: 'bracelet', diameterMm: 64,
    metal: 'gold', priceUsd: 100, imagePath: '/b.png', source: 'test', licence: 'test',
  },
  watch: {
    id: 'watch', name: 'Watch', brand: 'Darpan', type: 'watch', caseMm: 35, lugToLugMm: 43,
    watchSource: { width: 1104, height: 1472, x: 550, strapBegin: 30, caseTop: 320, caseBottom: 1100, strapEnd: 1440 },
    priceUsd: 240, imagePath: '/w.png', source: 'test', licence: 'test',
  },
}

const state = {
  photoId: 'personal-photo-hash', sizeCm: 4.5, irisPx: 41, ear: 'left' as const,
  finger: 4 as const, ringSizeUs: 8,
}

const extras: StylingExtras = {
  lipstick: { id: 'rose', name: 'Rose', hex: '#aa3344', texture: 'satin', intensity: 75 },
  hairUp: { templateId: 'braid', title: 'Braid' },
  outfit: { productId: 'emerald-blouse', title: 'Emerald blouse' },
  stack: [{ productId: 'dot-stud', sizeCm: 0.6, wearingLocation: [385, 620] }],
}

describe('buildTryOnRequest category field boundaries', () => {
  it.each(['earring', 'stud'] as const)('%s receives only face-flow calibration fields', (key) => {
    const body = buildTryOnRequest(products[key], state, extras)
    expect(body).toMatchObject({
      photoId: 'personal-photo-hash', productId: products[key].id, flow: 'ear',
      sizeCm: 4.5, irisPx: 41, occluded: 0, ear: 'left',
    })
    expect(body.stack).toEqual(extras.stack)
    expect(body).not.toHaveProperty('finger')
    expect(body).not.toHaveProperty('ringSizeUs')
    expect(body.options).toMatchObject({
      lipstick: { hex: '#aa3344', texture: 'satin', intensity: 75 },
      hairUp: { templateId: 'braid' },
      outfit: { productId: 'emerald-blouse' },
    })
  })

  it('necklace receives neck flow and styling without earring calibration or stack fields', () => {
    const body = buildTryOnRequest(products.necklace, state, extras)
    expect(body.photoId).toBe('personal-photo-hash')
    expect(body.flow).toBe('neck')
    expect(body).not.toHaveProperty('sizeCm')
    expect(body).not.toHaveProperty('irisPx')
    expect(body).not.toHaveProperty('ear')
    expect(body).not.toHaveProperty('stack')
    expect(body).not.toHaveProperty('finger')
    expect(body.options).toMatchObject({ outfit: { productId: 'emerald-blouse' } })
  })

  it.each(['ring', 'bracelet', 'watch'] as const)('%s receives hand flow without face-only options', (key) => {
    const body = buildTryOnRequest(products[key], state, extras)
    expect(body.photoId).toBe('personal-photo-hash')
    expect(body.productId).toBe(products[key].id)
    expect(body.flow).toBe('hand')
    expect(body).not.toHaveProperty('sizeCm')
    expect(body).not.toHaveProperty('irisPx')
    expect(body).not.toHaveProperty('ear')
    expect(body).not.toHaveProperty('stack')
    expect(body).not.toHaveProperty('options')
    if (key === 'ring') {
      expect(body.finger).toBe(4)
      expect(body.ringSizeUs).toBe(8)
    } else {
      expect(body).not.toHaveProperty('finger')
      expect(body).not.toHaveProperty('ringSizeUs')
    }
  })
})
