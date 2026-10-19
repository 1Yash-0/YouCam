/**
 * Milestone 1 Challenger 2 Empirical Stress Test Suite
 * 
 * Target Domains:
 * 1. useCart persistence, schema fidelity (darpan_bag_v1), dual thumbnail schema,
 *    quantity stepper, item removal, and live sync with Header BAG (N).
 * 2. Concurrency mutex in CompleteTheLook and useTryOn (isPresetRendering locking).
 * 3. Error recovery card display and action handlers on simulated pipeline errors
 *    (EAR_NOT_VISIBLE, NECK_NOT_VISIBLE, BUDGET_RESERVED, generic TRYON_FAILED).
 */

// Import polyfills FIRST before React DOM loads
import './dom-polyfill'
import { createMockElement, mockDoc } from './dom-polyfill'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React, { act } from 'react'
import ReactDOM from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

// Target system components & hooks
import {
  useCart,
  CART_STORAGE_KEY,
  CART_EVENT_UPDATED,
  CART_EVENT_OPEN,
  CART_EVENT_CLOSE,
  CartItem,
} from '@/hooks/useCart'
import { CartDrawer } from '@/components/tryon/CartDrawer'
import { CompleteTheLook } from '@/components/tryon/CompleteTheLook'
import { ErrorCard } from '@/components/tryon/ErrorCard'
import { useTryOn } from '@/hooks/useTryOn'
import { Product } from '@/lib/products'

// Helper to run React Hook in our Node test harness
function renderHookHarness<T>(hookFn: () => T) {
  let latestResult!: T
  function TestHarness() {
    latestResult = hookFn()
    return null
  }

  const container = createMockElement('div')
  container.ownerDocument = mockDoc
  const root = ReactDOM.createRoot(container)

  act(() => {
    root.render(React.createElement(TestHarness))
  })

  return {
    get current() {
      return latestResult
    },
    rerender() {
      act(() => {
        root.render(React.createElement(TestHarness))
      })
    },
    unmount() {
      act(() => {
        root.unmount()
      })
    },
  }
}

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------
const MOCK_PRODUCT: Product = {
  id: 'gilded-teardrop',
  name: 'Gilded Teardrop',
  brand: 'Kaari Studio',
  priceInr: 1499,
  type: 'single',
  heightCm: 3.0,
  widthCm: 1.3,
  sizes: [2.0, 3.0, 4.5, 6.0],
  metal: 'gold',
  imagePath: '/products/teardrop-gold.png',
  source: 'seed',
  licence: 'test',
}

describe('Milestone 1 Challenger 2: Cart Sync, Mutex & Error Recovery Stress Tests', () => {
  let storageMap: Record<string, string> = {}
  let eventListeners: Map<string, Set<Function>> = new Map()

  beforeEach(() => {
    storageMap = {}
    eventListeners = new Map()

    const mockLocalStorage = {
      getItem: vi.fn((key: string) => storageMap[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        storageMap[key] = String(val)
      }),
      removeItem: vi.fn((key: string) => {
        delete storageMap[key]
      }),
      clear: vi.fn(() => {
        storageMap = {}
      }),
    }

    const mockWindow: any = {
      Element: (global as any).Element,
      HTMLElement: (global as any).HTMLElement,
      HTMLIFrameElement: (global as any).HTMLIFrameElement,
      SVGElement: (global as any).SVGElement,
      document: mockDoc,
      localStorage: mockLocalStorage,
      location: new URL('http://localhost:3000'),
      addEventListener: vi.fn((type: string, listener: Function) => {
        if (!eventListeners.has(type)) eventListeners.set(type, new Set())
        eventListeners.get(type)!.add(listener)
      }),
      removeEventListener: vi.fn((type: string, listener: Function) => {
        eventListeners.get(type)?.delete(listener)
      }),
      dispatchEvent: vi.fn((event: any) => {
        const listeners = eventListeners.get(event.type)
        if (listeners) {
          for (const listener of Array.from(listeners)) {
            listener(event)
          }
        }
        return true
      }),
    }

    mockDoc.defaultView = mockWindow
    ;(global as any).window = mockWindow
    ;(global as any).location = mockWindow.location
    ;(global as any).localStorage = mockLocalStorage
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // =========================================================================
  // DOMAIN 1: useCart Persistence, Dual Thumbnail Schema & Cross-Hook Sync
  // =========================================================================
  describe('Domain 1: useCart Persistence, Dual Thumbnail Schema & Bag Sync', () => {
    it('1.1 verifies storage constant key is darpan_bag_v1 and event is darpan:cart_updated', () => {
      expect(CART_STORAGE_KEY).toBe('darpan_bag_v1')
      expect(CART_EVENT_UPDATED).toBe('darpan:cart_updated')
    })

    it('1.2 hydrates pre-existing cart items from localStorage on mount', () => {
      const initialItems: CartItem[] = [
        {
          id: 'gilded-teardrop-3',
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 3.0,
          priceInr: 1499,
          quantity: 2,
          productImageUrl: '/products/teardrop-gold.png',
          tryOnThumbnailUrl: '/api/result/portrait-thumb-1',
          triedOnAtCm: 3.02,
        },
      ]
      storageMap[CART_STORAGE_KEY] = JSON.stringify(initialItems)

      const harness = renderHookHarness(() => useCart())

      expect(harness.current.items).toHaveLength(1)
      expect(harness.current.items[0].id).toBe('gilded-teardrop-3')
      expect(harness.current.totalCount).toBe(2)
      expect(harness.current.subtotalInr).toBe(1499 * 2)
      expect(harness.current.isHydrated).toBe(true)

      harness.unmount()
    })

    it('1.3 gracefully handles malformed/corrupt JSON in localStorage without crash', () => {
      storageMap[CART_STORAGE_KEY] = '{invalid-json:broken}'
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const harness = renderHookHarness(() => useCart())

      expect(harness.current.items).toEqual([])
      expect(harness.current.totalCount).toBe(0)
      expect(harness.current.subtotalInr).toBe(0)
      expect(harness.current.isHydrated).toBe(true)
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      harness.unmount()
    })

    it('1.4 gracefully handles valid JSON that is not an array (e.g. object, number, boolean)', () => {
      storageMap[CART_STORAGE_KEY] = JSON.stringify({ productId: 'gilded-teardrop' })

      const harness = renderHookHarness(() => useCart())

      expect(harness.current.items).toEqual([])
      expect(harness.current.totalCount).toBe(0)
      harness.unmount()
    })

    it('1.5 addItem generates deterministic id `${productId}-${sizeCm}` when not provided', () => {
      const harness = renderHookHarness(() => useCart())

      act(() => {
        harness.current.addItem({
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 3.0,
          priceInr: 1499,
          productImageUrl: '/products/teardrop-gold.png',
        })
      })

      expect(harness.current.items).toHaveLength(1)
      expect(harness.current.items[0].id).toBe('gilded-teardrop-3')
      expect(harness.current.items[0].quantity).toBe(1)
      expect(harness.current.totalCount).toBe(1)
      expect(harness.current.subtotalInr).toBe(1499)

      // Verify persisted to localStorage
      const stored = JSON.parse(storageMap[CART_STORAGE_KEY])
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('gilded-teardrop-3')

      harness.unmount()
    })

    it('1.6 addItem preserves dual thumbnail schema (productImageUrl + tryOnThumbnailUrl + triedOnAtCm)', () => {
      const harness = renderHookHarness(() => useCart())

      act(() => {
        harness.current.addItem({
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 3.0,
          priceInr: 1499,
          productImageUrl: '/products/teardrop-gold.png',
          tryOnThumbnailUrl: '/api/result/sample-result.png',
          triedOnAtCm: 3.01,
        })
      })

      const item = harness.current.items[0]
      expect(item.productImageUrl).toBe('/products/teardrop-gold.png')
      expect(item.tryOnThumbnailUrl).toBe('/api/result/sample-result.png')
      expect(item.triedOnAtCm).toBe(3.01)

      harness.unmount()
    })

    it('1.7 addItem with same productId and sizeCm increments quantity and updates try-on thumb', () => {
      const harness = renderHookHarness(() => useCart())

      act(() => {
        harness.current.addItem({
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 3.0,
          priceInr: 1499,
          productImageUrl: '/products/teardrop-gold.png',
          quantity: 1,
        })
      })

      expect(harness.current.items).toHaveLength(1)
      expect(harness.current.items[0].quantity).toBe(1)

      // Add same product + same physical size again with try-on thumbnail
      act(() => {
        harness.current.addItem({
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 3.0,
          priceInr: 1499,
          productImageUrl: '/products/teardrop-gold.png',
          tryOnThumbnailUrl: '/api/result/worn-portrait-1.png',
          triedOnAtCm: 3.0,
          quantity: 2,
        })
      })

      expect(harness.current.items).toHaveLength(1)
      expect(harness.current.items[0].quantity).toBe(3)
      expect(harness.current.items[0].tryOnThumbnailUrl).toBe('/api/result/worn-portrait-1.png')
      expect(harness.current.totalCount).toBe(3)
      expect(harness.current.subtotalInr).toBe(1499 * 3)

      harness.unmount()
    })

    it('1.8 addItem with same productId but DIFFERENT sizeCm creates separate line items', () => {
      const harness = renderHookHarness(() => useCart())

      act(() => {
        harness.current.addItem({
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 3.0,
          priceInr: 1499,
          productImageUrl: '/products/teardrop-gold.png',
        })
      })

      act(() => {
        harness.current.addItem({
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 4.5,
          priceInr: 1499,
          productImageUrl: '/products/teardrop-gold.png',
        })
      })

      expect(harness.current.items).toHaveLength(2)
      expect(harness.current.items[0].id).toBe('gilded-teardrop-3')
      expect(harness.current.items[0].sizeCm).toBe(3.0)
      expect(harness.current.items[1].id).toBe('gilded-teardrop-4.5')
      expect(harness.current.items[1].sizeCm).toBe(4.5)
      expect(harness.current.totalCount).toBe(2)

      harness.unmount()
    })

    it('1.9 updateQuantity increments, decrements, and removes item when quantity <= 0', () => {
      const harness = renderHookHarness(() => useCart())

      act(() => {
        harness.current.addItem({
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 3.0,
          priceInr: 1499,
          productImageUrl: '/products/teardrop-gold.png',
          quantity: 2,
        })
      })

      // Increase quantity to 5
      act(() => {
        harness.current.updateQuantity('gilded-teardrop-3', 5)
      })
      expect(harness.current.items[0].quantity).toBe(5)
      expect(harness.current.totalCount).toBe(5)
      expect(harness.current.subtotalInr).toBe(1499 * 5)

      // Decrease quantity to 1
      act(() => {
        harness.current.updateQuantity('gilded-teardrop-3', 1)
      })
      expect(harness.current.items[0].quantity).toBe(1)
      expect(harness.current.totalCount).toBe(1)

      // Decrease quantity to 0 -> should remove item entirely
      act(() => {
        harness.current.updateQuantity('gilded-teardrop-3', 0)
      })
      expect(harness.current.items).toHaveLength(0)
      expect(harness.current.totalCount).toBe(0)
      expect(harness.current.subtotalInr).toBe(0)

      harness.unmount()
    })

    it('1.10 removeItem deletes target item while preserving other items', () => {
      const harness = renderHookHarness(() => useCart())

      act(() => {
        harness.current.addItem({
          id: 'item-1',
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 3.0,
          priceInr: 1499,
          productImageUrl: '/products/teardrop-gold.png',
        })
        harness.current.addItem({
          id: 'item-2',
          productId: 'orb-chain',
          title: 'Orb Chain',
          brand: 'Kaari Studio',
          sizeCm: 40.0,
          priceInr: 2999,
          productImageUrl: '/products/orb-chain.png',
        })
      })

      expect(harness.current.items).toHaveLength(2)

      act(() => {
        harness.current.removeItem('item-1')
      })

      expect(harness.current.items).toHaveLength(1)
      expect(harness.current.items[0].id).toBe('item-2')
      expect(harness.current.items[0].productId).toBe('orb-chain')
      expect(harness.current.totalCount).toBe(1)
      expect(harness.current.subtotalInr).toBe(2999)

      harness.unmount()
    })

    it('1.11 clearCart flushes all items and persists empty array', () => {
      const harness = renderHookHarness(() => useCart())

      act(() => {
        harness.current.addItem({
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 3.0,
          priceInr: 1499,
          productImageUrl: '/products/teardrop-gold.png',
        })
      })

      expect(harness.current.items).toHaveLength(1)

      act(() => {
        harness.current.clearCart()
      })

      expect(harness.current.items).toHaveLength(0)
      expect(harness.current.totalCount).toBe(0)
      expect(harness.current.subtotalInr).toBe(0)
      expect(storageMap[CART_STORAGE_KEY]).toBe('[]')

      harness.unmount()
    })

    it('1.12 Header BAG (N) synchronization across concurrent hook instances', () => {
      // Simulate Instance A (Drawer / PDP) and Instance B (Header)
      const instanceA = renderHookHarness(() => useCart())
      const instanceB = renderHookHarness(() => useCart())

      expect(instanceA.current.totalCount).toBe(0)
      expect(instanceB.current.totalCount).toBe(0)

      // Instance A adds an item
      act(() => {
        instanceA.current.addItem({
          productId: 'gilded-teardrop',
          title: 'Gilded Teardrop',
          brand: 'Kaari Studio',
          sizeCm: 3.0,
          priceInr: 1499,
          productImageUrl: '/products/teardrop-gold.png',
          quantity: 3,
        })
      })

      // Instance B (Header) must be synchronized in real time via CART_EVENT_UPDATED
      expect(instanceA.current.totalCount).toBe(3)
      expect(instanceB.current.totalCount).toBe(3)
      expect(instanceB.current.subtotalInr).toBe(1499 * 3)
      expect(instanceB.current.items).toHaveLength(1)

      // Instance B updates quantity
      act(() => {
        instanceB.current.updateQuantity('gilded-teardrop-3', 1)
      })

      expect(instanceA.current.totalCount).toBe(1)
      expect(instanceB.current.totalCount).toBe(1)

      instanceA.unmount()
      instanceB.unmount()
    })

    it('1.13 cross-tab synchronization via window storage event', () => {
      const harness = renderHookHarness(() => useCart())
      expect(harness.current.totalCount).toBe(0)

      // External tab updates localStorage and fires 'storage' event
      const externalItems: CartItem[] = [
        {
          id: 'external-item',
          productId: 'orb-chain',
          title: 'Orb Chain',
          brand: 'Kaari Studio',
          sizeCm: 40.0,
          priceInr: 2999,
          quantity: 2,
          productImageUrl: '/products/orb-chain.png',
        },
      ]
      storageMap[CART_STORAGE_KEY] = JSON.stringify(externalItems)

      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY }))
      })

      expect(harness.current.items).toHaveLength(1)
      expect(harness.current.items[0].id).toBe('external-item')
      expect(harness.current.totalCount).toBe(2)
      expect(harness.current.subtotalInr).toBe(2999 * 2)

      harness.unmount()
    })

    it('1.14 openCart, closeCart, toggleCart dispatch corresponding window events', () => {
      const openSpy = vi.fn()
      const closeSpy = vi.fn()
      window.addEventListener(CART_EVENT_OPEN, openSpy)
      window.addEventListener(CART_EVENT_CLOSE, closeSpy)

      const harness = renderHookHarness(() => useCart())

      act(() => {
        harness.current.openCart()
      })
      expect(openSpy).toHaveBeenCalledTimes(1)
      expect(harness.current.isCartOpen).toBe(true)

      act(() => {
        harness.current.closeCart()
      })
      expect(closeSpy).toHaveBeenCalledTimes(1)
      expect(harness.current.isCartOpen).toBe(false)

      act(() => {
        harness.current.toggleCart()
      })
      expect(openSpy).toHaveBeenCalledTimes(2)
      expect(harness.current.isCartOpen).toBe(true)

      window.removeEventListener(CART_EVENT_OPEN, openSpy)
      window.removeEventListener(CART_EVENT_CLOSE, closeSpy)
      harness.unmount()
    })

    it('1.15 CartDrawer renders empty state when bag has no items', () => {
      const html = renderToStaticMarkup(
        React.createElement(CartDrawer, {
          isOpen: true,
          onClose: () => {},
        })
      )

      expect(html).toContain('YOUR BAG')
      expect(html).toContain('Your bag is empty')
      expect(html).toContain('EXPLORE COLLECTION')
    })
  })

  // =========================================================================
  // DOMAIN 2: Concurrency Mutex in CompleteTheLook & useTryOn
  // =========================================================================
  describe('Domain 2: Concurrency Mutex in CompleteTheLook & Preset Locking', () => {
    it('2.1 disables all preset buttons when isRendering is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(CompleteTheLook, {
          extras: {},
          isRendering: true,
          cachedPresets: new Set<string>(),
          onToggleLipstick: () => {},
          onToggleHairUp: () => {},
          onToggleOutfit: () => {},
          onToggleStack: () => {},
        })
      )

      expect(html).toContain('RENDERING…')
      // All 4 buttons must have disabled attribute
      const disabledMatches = html.match(/disabled=""/g) || []
      expect(disabledMatches.length).toBe(4)
    })

    it('2.2 enables all preset buttons when isRendering is false', () => {
      const html = renderToStaticMarkup(
        React.createElement(CompleteTheLook, {
          extras: {},
          isRendering: false,
          cachedPresets: new Set(['berry-satin']),
          onToggleLipstick: () => {},
          onToggleHairUp: () => {},
          onToggleOutfit: () => {},
          onToggleStack: () => {},
        })
      )

      expect(html).not.toContain('RENDERING…')
      expect(html).not.toContain('disabled=""')
    })

    it('2.3 displays FAST badge for cached presets and checkmark for active preset', () => {
      const html = renderToStaticMarkup(
        React.createElement(CompleteTheLook, {
          extras: { hairUp: { templateId: 'braid-01', title: 'Two Braids Updo' } },
          isRendering: false,
          cachedPresets: new Set(['berry-satin']),
          onToggleLipstick: () => {},
          onToggleHairUp: () => {},
          onToggleOutfit: () => {},
          onToggleStack: () => {},
        })
      )

      // Cached lipstick shows FAST badge when not active
      expect(html).toContain('FAST')
      // Active hairUp shows checkmark ✓
      expect(html).toContain('✓')
    })

    it('2.4 useTryOn exposes preset toggles with isPresetRendering locking guard', () => {
      const harness = renderHookHarness(() => useTryOn({ product: MOCK_PRODUCT }))

      act(() => {
        harness.current.selectSampleFace()
      })
      expect(harness.current.state.photoId).toBeDefined()
      expect(harness.current.state.isPresetRendering).toBe(false)

      expect(typeof harness.current.toggleLipstick).toBe('function')
      expect(typeof harness.current.toggleHairUp).toBe('function')
      expect(typeof harness.current.toggleOutfit).toBe('function')
      expect(typeof harness.current.toggleStack).toBe('function')
      expect(typeof harness.current.selectLipstickShade).toBe('function')

      harness.unmount()
    })

    it('2.5 preset rendering clears isPresetRendering to false on completion and error', async () => {
      // Test completion path
      global.fetch = vi.fn().mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          status: 'done',
          result: { key: 'k1', imageUrl: '/done.png', measurement: { renderedCm: 3.0, tolerancePct: 5 } },
        }),
      }))

      const harness = renderHookHarness(() => useTryOn({ product: MOCK_PRODUCT }))
      act(() => {
        harness.current.selectSampleFace()
      })

      await act(async () => {
        await harness.current.toggleHairUp()
      })

      expect(harness.current.state.isPresetRendering).toBe(false)
      expect(harness.current.state.step).toBe('result')

      // Test error path
      global.fetch = vi.fn().mockImplementationOnce(async () => ({
        ok: false,
        json: async () => ({
          code: 'EAR_NOT_VISIBLE',
          userMessage: 'Turn your head slightly',
        }),
      }))

      await act(async () => {
        await harness.current.toggleLipstick()
      })

      expect(harness.current.state.isPresetRendering).toBe(false)
      expect(harness.current.state.step).toBe('error')

      harness.unmount()
    })

    it('2.6 verifies concurrency mutex strictly blocks all preset toggles while isPresetRendering is true', async () => {
      let resolvePromise: any
      const fetchSpy = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolvePromise = resolve
        })
      })
      global.fetch = fetchSpy

      const harness = renderHookHarness(() => useTryOn({ product: MOCK_PRODUCT }))
      act(() => {
        harness.current.selectSampleFace()
      })

      // Click 1: User toggles lipstick
      act(() => {
        harness.current.toggleLipstick()
      })

      // Harness has re-rendered: isPresetRendering is active
      expect(harness.current.state.isPresetRendering).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Subsequent clicks on ANY preset while job is in-flight must be rejected by mutex
      act(() => {
        harness.current.toggleLipstick()
        harness.current.toggleHairUp()
        harness.current.toggleOutfit()
        harness.current.toggleStack()
      })

      // Call count must strictly remain 1!
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Resolve the pending job
      await act(async () => {
        resolvePromise({
          ok: true,
          json: async () => ({
            status: 'done',
            result: { key: 'done-key', imageUrl: '/done.png' },
          }),
        })
      })

      expect(harness.current.state.isPresetRendering).toBe(false)
      harness.unmount()
    })

    it('2.7 verifies UI level defense: CompleteTheLook disables buttons immediately when isRendering is true', () => {
      // In the browser DOM, CompleteTheLook sets disabled={isRendering}.
      // When isRendering is true, native browser buttons do not dispatch click events.
      const onClickSpy = vi.fn()
      const html = renderToStaticMarkup(
        React.createElement(CompleteTheLook, {
          extras: {},
          isRendering: true,
          cachedPresets: new Set<string>(),
          onToggleLipstick: onClickSpy,
          onToggleHairUp: onClickSpy,
          onToggleOutfit: onClickSpy,
          onToggleStack: onClickSpy,
        })
      )

      expect(html).toContain('RENDERING…')
      // All preset buttons have disabled=""
      const disabledCount = (html.match(/disabled=""/g) || []).length
      expect(disabledCount).toBe(4)
      expect(onClickSpy).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // DOMAIN 3: Error Recovery Card on Simulated Pipeline Failures
  // =========================================================================
  describe('Domain 3: Error Recovery Card on Simulated Pipeline Failures', () => {
    it('3.1 EAR_NOT_VISIBLE displays anatomical EAR marker, guidance copy, and SWITCH TO OTHER EAR action', () => {
      const onSwitchEar = vi.fn()
      const onReupload = vi.fn()

      const html = renderToStaticMarkup(
        React.createElement(ErrorCard, {
          error: {
            code: 'EAR_NOT_VISIBLE',
            userMessage: 'Turn your head slightly and tuck your hair behind your ear.',
            recoveryAction: 'ear',
          },
          photoUrl: '/sample-face.png',
          onUseSampleFace: () => {},
          onRetry: () => {},
          onReupload,
          onSwitchEar,
        })
      )

      // Anatomical EAR marker
      expect(html).toContain('EAR')
      expect(html).toContain('border-dashed')
      expect(html).toContain('border-[var(--gold)]')

      // Dimmed user portrait
      expect(html).toContain('opacity-25')
      expect(html).toContain('filter grayscale')

      // Guidance headline and copy
      expect(html).toContain('Tuck hair behind your ear')
      expect(html).toContain('Turn your head slightly and tuck your hair behind your ear.')

      // Primary & secondary CTAs
      expect(html).toContain('SWITCH TO OTHER EAR')
      expect(html).toContain('UPLOAD NEW PHOTO')
    })

    it('3.2 NECK_NOT_VISIBLE displays COLLARBONE marker, guidance copy, and TRY AGAIN action', () => {
      const html = renderToStaticMarkup(
        React.createElement(ErrorCard, {
          error: {
            code: 'NECK_NOT_VISIBLE',
            userMessage: 'Face the camera straight on with your neck and collarbones visible.',
            recoveryAction: 'retry',
          },
          photoUrl: '/sample-face.png',
          onUseSampleFace: () => {},
          onRetry: () => {},
          onReupload: () => {},
          onSwitchEar: () => {},
        })
      )

      expect(html).toContain('COLLARBONE')
      expect(html).toContain('Try-on needs adjustment')
      expect(html).toContain('Face the camera straight on with your neck and collarbones visible.')
      expect(html).toContain('TRY AGAIN')
      expect(html).toContain('USE SAMPLE FACE INSTEAD')
    })

    it('3.3 BUDGET_RESERVED displays quota guidance and 0-unit pre-calibrated sample face action', () => {
      const html = renderToStaticMarkup(
        React.createElement(ErrorCard, {
          error: {
            code: 'BUDGET_RESERVED',
            userMessage: 'Demo API quota preserved for verified looks.',
            recoveryAction: 'sample',
          },
          photoUrl: '/sample-face.png',
          onUseSampleFace: () => {},
          onRetry: () => {},
          onReupload: () => {},
          onSwitchEar: () => {},
        })
      )

      expect(html).toContain('Demo budget preserved')
      expect(html).toContain('Demo API quota preserved for verified looks.')
      expect(html).toContain('USE PRE-CALIBRATED SAMPLE FACE (0 UNITS)')
    })

    it('3.4 generic TRYON_FAILED displays retry and sample fallback actions', () => {
      const html = renderToStaticMarkup(
        React.createElement(ErrorCard, {
          error: {
            code: 'TRYON_FAILED',
            userMessage: 'Pipeline could not complete render within tolerance.',
            recoveryAction: 'retry',
          },
          photoUrl: '/sample-face.png',
          onUseSampleFace: () => {},
          onRetry: () => {},
          onReupload: () => {},
          onSwitchEar: () => {},
        })
      )

      expect(html).toContain('CALIBRATION ADVICE')
      expect(html).toContain('Try-on needs adjustment')
      expect(html).toContain('Pipeline could not complete render within tolerance.')
      expect(html).toContain('TRY AGAIN')
      expect(html).toContain('USE SAMPLE FACE INSTEAD')
    })

    it('3.5 useTryOn error transition maps EAR_NOT_VISIBLE recovery to ear switch and re-submission', async () => {
      const fetchSpy = vi.fn().mockImplementation(async () => ({
        ok: false,
        json: async () => ({
          code: 'EAR_NOT_VISIBLE',
          userMessage: 'Turn your head slightly and tuck your hair behind your ear.',
        }),
      }))
      global.fetch = fetchSpy

      const harness = renderHookHarness(() => useTryOn({ product: MOCK_PRODUCT }))

      act(() => {
        harness.current.selectSampleFace()
      })
      expect(harness.current.state.ear).toBe('right')

      await act(async () => {
        await harness.current.submitTryOn()
      })

      expect(harness.current.state.step).toBe('error')
      expect(harness.current.state.error?.code).toBe('EAR_NOT_VISIBLE')
      expect(harness.current.state.error?.recoveryAction).toBe('ear')

      // Test switchEar action
      act(() => {
        harness.current.switchEar()
      })
      expect(harness.current.state.ear).toBe('left')

      harness.unmount()
    })

    it('3.6 useTryOn reupload action resets drawer state cleanly to photo step', () => {
      const harness = renderHookHarness(() => useTryOn({ product: MOCK_PRODUCT }))

      act(() => {
        harness.current.selectSampleFace()
      })
      expect(harness.current.state.photoId).toBeDefined()

      act(() => {
        harness.current.reupload()
      })

      expect(harness.current.state.step).toBe('photo')
      expect(harness.current.state.photoId).toBeNull()
      expect(harness.current.state.photoUrl).toBeNull()
      expect(harness.current.state.error).toBeNull()

      harness.unmount()
    })
  })
})
