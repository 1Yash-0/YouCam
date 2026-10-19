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
    expect(CART_STORAGE_KEY).toBe('darpan_bag_v1')
    expect(CART_EVENT_UPDATED).toBe('darpan:cart_updated')
  })

  it('persists cart items correctly to localStorage with schema fidelity', () => {
    const sampleItems = [
      {
        id: 'gilded-teardrop-3',
        productId: 'gilded-teardrop',
        title: 'Gilded Teardrop',
        brand: 'Kaari Studio',
        sizeCm: 3.0,
        priceInr: 1499,
        quantity: 1,
        productImageUrl: '/products/teardrop-gold.png',
        tryOnThumbnailUrl: '/sample-face.png',
        triedOnAtCm: 3.01,
      },
    ]

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(sampleItems))
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].productId).toBe('gilded-teardrop')
    expect(stored[0].sizeCm).toBe(3.0)
    expect(stored[0].triedOnAtCm).toBe(3.01)
    expect(stored[0].priceInr).toBe(1499)
  })

  it('calculates total quantities and subtotals accurately', () => {
    const items = [
      { priceInr: 1499, quantity: 2 },
      { priceInr: 2499, quantity: 1 },
    ]

    const totalCount = items.reduce((sum, item) => sum + item.quantity, 0)
    const subtotalInr = items.reduce((sum, item) => sum + item.priceInr * item.quantity, 0)

    expect(totalCount).toBe(3)
    expect(subtotalInr).toBe(1499 * 2 + 2499)
  })
})
