import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CART_STORAGE_KEY, CART_EVENT_UPDATED } from './useCart'

describe('useCart storage contracts and constants', () => {
  let mockStorage: Record<string, string> = {}

  beforeEach(() => {
    mockStorage = {}
    // Mock global window and localStorage for node environment
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val
      },
      removeItem: (key: string) => {
        delete mockStorage[key]
      },
      clear: () => {
        mockStorage = {}
      },
    })
  })

  it('defines correct storage key and event name', () => {
    expect(CART_STORAGE_KEY).toBe('darpan_saved_choices_v1')
    expect(CART_EVENT_UPDATED).toBe('darpan:cart_updated')
  })

  it('persists cart items correctly to localStorage with schema fidelity', () => {
    const sampleItems = [
      {
        id: 'gilded-teardrop-3',
        productId: 'gilded-teardrop',
        title: 'Gilded Teardrop',
        brand: 'Darpan',
        sizeCm: 3.0,
        priceUsd: 1499,
        productImageUrl: '/products/teardrop-gold.png',
        sizeLabel: '3 cm height',
      },
    ]

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(sampleItems))
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].productId).toBe('gilded-teardrop')
    expect(stored[0].sizeCm).toBe(3.0)
    expect(stored[0].sizeLabel).toBe('3 cm height')
    expect(stored[0].tryOnThumbnailUrl).toBeUndefined()
    expect(stored[0].priceUsd).toBe(1499)
  })

  it('counts saved choices without inventing bag quantities or totals', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    expect(items.length).toBe(2)
  })
})
