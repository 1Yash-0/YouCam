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
  brand: 'Darpan',
  priceUsd: 1499,
  type: 'single',
  heightCm: 3.0,
  widthCm: 1.3,
  sizes: [2.0, 3.0, 4.5, 6.0],
  metal: 'gold',
  imagePath: '/products/teardrop-gold.png',
  source: 'seed',
  licence: 'test',
}

async function uploadPersonalPhoto(harness: ReturnType<typeof renderHookHarness<any>>) {
  const file = new File(['local test image'], 'portrait.jpg', { type: 'image/jpeg' })
  await act(async () => {
    await harness.current.uploadPhoto(file)
  })
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
      sessionStorage: {
        getItem: vi.fn((key: string) => storageMap[`session:${key}`] ?? null),
        setItem: vi.fn((key: string, val: string) => { storageMap[`session:${key}`] = String(val) }),
        removeItem: vi.fn((key: string) => { delete storageMap[`session:${key}`] }),
        clear: vi.fn(() => { storageMap = {} }),
      },
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
    ;(global as any).sessionStorage = mockWindow.sessionStorage
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // =========================================================================
  // DOMAIN 1: Saved choice metadata, sync and privacy
  describe('Domain 1: Saved choice metadata and sync', () => {
    it('uses the saved choices storage key and update event', () => {
      expect(CART_STORAGE_KEY).toBe('darpan_saved_choices_v1')
      expect(CART_EVENT_UPDATED).toBe('darpan:cart_updated')
    })

    it('hydrates saved product metadata and does not keep legacy photo URLs', () => {
      storageMap[CART_STORAGE_KEY] = JSON.stringify([{
        id: 'gilded-teardrop-3', productId: 'gilded-teardrop', title: 'Gilded Teardrop',
        brand: 'Darpan', sizeCm: 3, sizeLabel: '3 cm drop', priceUsd: 1499,
        productImageUrl: '/products/teardrop-gold.png',
      }])
      storageMap.darpan_bag_v1 = JSON.stringify([{ tryOnThumbnailUrl: '/private/result.png' }])
      const harness = renderHookHarness(() => useCart())
      expect(harness.current.items).toHaveLength(1)
      expect(harness.current.items[0].sizeLabel).toBe('3 cm drop')
      expect(harness.current.totalCount).toBe(1)
      expect(storageMap.darpan_bag_v1).toBeUndefined()
      harness.unmount()
    })

    it('handles malformed storage without crashing', () => {
      storageMap[CART_STORAGE_KEY] = '{invalid-json:broken}'
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const harness = renderHookHarness(() => useCart())
      expect(harness.current.items).toEqual([])
      expect(harness.current.totalCount).toBe(0)
      expect(harness.current.isHydrated).toBe(true)
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
      harness.unmount()
    })

    it('deduplicates the same product choice but keeps distinct ring selections separate', () => {
      const harness = renderHookHarness(() => useCart())
      const base = {
        productId: 'met-carnelian-ring', title: 'Carnelian Swivel Ring', brand: 'Met',
        sizeCm: 0, priceUsd: 170, productImageUrl: '/products/met-ring.jpg',
      }
      act(() => {
        harness.current.addItem({ ...base, selectionKey: 'us-6', sizeLabel: '15 mm stone · US 6 assumed' })
        harness.current.addItem({ ...base, selectionKey: 'us-6', sizeLabel: '15 mm stone · US 6 assumed' })
        harness.current.addItem({ ...base, selectionKey: 'us-7', sizeLabel: '15 mm stone · US 7 assumed' })
      })
      expect(harness.current.items).toHaveLength(2)
      expect(harness.current.items.map(item => item.id)).toEqual(['met-carnelian-ring-us-6', 'met-carnelian-ring-us-7'])
      expect(harness.current.totalCount).toBe(2)
      const saved = JSON.stringify(harness.current.items)
      expect(saved).not.toContain('tryOnThumbnailUrl')
      expect(saved).not.toContain('/private/')
      harness.unmount()
    })

    it('removes saved choices and syncs changes to other hook instances', () => {
      const a = renderHookHarness(() => useCart())
      const b = renderHookHarness(() => useCart())
      act(() => a.current.addItem({
        productId: 'gilded-teardrop', title: 'Gilded Teardrop', brand: 'Darpan',
        sizeCm: 3, sizeLabel: '3 cm drop', priceUsd: 89, productImageUrl: '/products/teardrop.png',
      }))
      expect(b.current.totalCount).toBe(1)
      act(() => b.current.removeItem('gilded-teardrop-3'))
      expect(a.current.totalCount).toBe(0)
      expect(storageMap[CART_STORAGE_KEY]).toBe('[]')
      a.unmount()
      b.unmount()
    })

    it('opens and closes the saved choices drawer with events', () => {
      const harness = renderHookHarness(() => useCart())
      act(() => harness.current.openCart())
      expect(harness.current.isCartOpen).toBe(true)
      act(() => harness.current.closeCart())
      expect(harness.current.isCartOpen).toBe(false)
      harness.unmount()
    })

    it('renders saved choices language and photo privacy copy', () => {
      const html = renderToStaticMarkup(React.createElement(CartDrawer, { isOpen: true, onClose: () => {} }))
      expect(html).toContain('>Bag<')
      expect(html).toContain('Your bag is empty')
      expect(html).toContain('Your try-on photo is not saved with it.')
    })
  })

  // DOMAIN 2: Concurrency Mutex in CompleteTheLook & useTryOn
  // =========================================================================
  describe('Domain 2: Concurrency Mutex in CompleteTheLook & Preset Locking', () => {
    it('2.1 disables optional styling controls while an apply request is running', () => {
      const html = renderToStaticMarkup(
        React.createElement(CompleteTheLook, {
          extras: {},
          isRendering: true,
          onApplyStyling: () => {},
        })
      )

      expect(html).toContain('aria-label="Optional styling"')
      expect(html).toContain('Applying styling…')
      expect(html).toContain('aria-label="Optional styling"><div')
      const disabledMatches = html.match(/disabled=""/g) || []
      expect(disabledMatches.length).toBeGreaterThanOrEqual(4)
    })

    it('2.2 exposes optional controls and enables Apply when a handler is provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(CompleteTheLook, {
          extras: {},
          isRendering: false,
          onApplyStyling: () => {},
        })
      )

      expect(html).not.toContain('Applying styling…')
      expect(html).toContain('Optional styling')
      expect(html).toContain('Lip colour')
      expect(html).toContain('Choose style')
      expect(html).toContain('>Apply styling</button>')
      expect(html).not.toContain('<input type="checkbox" disabled=""')
    })

    it('2.3 displays selected optional styling and the explicit Apply action', () => {
      const html = renderToStaticMarkup(
        React.createElement(CompleteTheLook, {
          extras: {
            hairUp: { templateId: 'braid-01', title: 'Two Braids Updo' },
            lipstick: { id: 'berry-satin', name: 'Berry', hex: '#9B1B30', texture: 'satin', intensity: 80 },
          },
          isRendering: false,
          onApplyStyling: () => {},
        })
      )

      expect(html).toContain('Selected: Two Braids Updo')
      expect(html).toContain('aria-label="Berry lipstick shade"')
      expect(html).toContain('aria-pressed="true"')
      expect(html).toContain('>Apply styling</button>')
      expect(html).not.toContain('FAST')
    })

    it('2.4 loads a reviewed sample immediately and ignores every paid styling request', async () => {
      const fetchSpy = vi.fn()
      global.fetch = fetchSpy
      const harness = renderHookHarness(() => useTryOn({ product: MOCK_PRODUCT }))

      act(() => {
        harness.current.selectSampleFace()
      })
      expect(harness.current.state.photoId).toBeDefined()
      expect(harness.current.state.step).toBe('result')
      expect(harness.current.state.resultImageUrl).toBe('/samples/single-teardrop-3cm.png')
      expect(harness.current.state.isPresetRendering).toBe(false)

      act(() => {
        harness.current.toggleLipstick()
        harness.current.toggleHairUp()
        harness.current.toggleOutfit()
        harness.current.toggleStack()
        harness.current.selectLipstickShade({ id: 'rose', name: 'Rose', hex: '#aa3344', texture: 'satin', intensity: 80 })
      })
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(harness.current.state.extras).toEqual({})
      expect(harness.current.state.resultImageUrl).toBe('/samples/single-teardrop-3cm.png')

      harness.unmount()
    })

    it('2.5 clears preset-rendering state after personal-photo completion and API error', async () => {
      const taskResponses = [
        { ok: true, json: async () => ({ status: 'done', result: { key: 'k1', imageUrl: '/done.png', measurement: { renderedCm: 3, tolerancePct: 5, withinTolerance: true } } }) },
        { ok: false, json: async () => ({ code: 'EAR_NOT_VISIBLE', userMessage: 'Turn your head slightly' }) },
      ]
      global.fetch = vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith('/api/photo/upload')) return { ok: true, json: async () => ({}) } as Response
        if (String(input).endsWith('/api/photo')) return { ok: true, json: async () => ({ photoId: 'uploaded-personal-photo', width: 1000, height: 1200 }) } as Response
        if (String(input).endsWith('/api/hair/templates')) return {
          ok: true,
          json: async () => [{ id: 'female_two_braids', title: 'Two Braids', thumb: '/braids.jpg', keepsColour: false }],
        } as Response
        return taskResponses.shift() as Response
      })

      const harness = renderHookHarness(() => useTryOn({ product: MOCK_PRODUCT }))
      await uploadPersonalPhoto(harness)

      act(() => harness.current.setStep('result'))
      await act(async () => {
        await harness.current.applyStyling({ hairUp: { templateId: 'female_two_braids', title: 'Two Braids' } })
      })

      expect(harness.current.state.isPresetRendering).toBe(false)
      expect(harness.current.state.step).toBe('result')

      // Test error path
      await act(async () => {
        await harness.current.applyStyling({ lipstick: { id: 'berry-satin', name: 'Berry', hex: '#9B1B30', texture: 'satin', intensity: 80 } })
      })

      expect(harness.current.state.isPresetRendering).toBe(false)
      expect(harness.current.state.step).toBe('error')

      harness.unmount()
    })

    it('2.6 mutex blocks concurrent personal-photo preset submissions', async () => {
      let resolvePromise!: (response: Response) => void
      const fetchSpy = vi.fn((input: RequestInfo | URL): Promise<Response> => {
        if (String(input).endsWith('/api/photo/upload')) return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
        if (String(input).endsWith('/api/photo')) return Promise.resolve({ ok: true, json: async () => ({ photoId: 'uploaded-personal-photo', width: 1000, height: 1200 }) } as Response)
        return new Promise<Response>((resolve) => {
          resolvePromise = resolve
        })
      })
      global.fetch = fetchSpy

      const harness = renderHookHarness(() => useTryOn({ product: MOCK_PRODUCT }))
      await uploadPersonalPhoto(harness)

      act(() => harness.current.setStep('result'))
      const lipstickDraft = { lipstick: { id: 'berry-satin', name: 'Berry', hex: '#9B1B30', texture: 'satin' as const, intensity: 80 } }
      act(() => { void harness.current.applyStyling(lipstickDraft) })

      // Harness has re-rendered: isPresetRendering is active
      expect(harness.current.state.isPresetRendering).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(3)

      // A second explicit apply while the first request is active is rejected by the mutex.
      act(() => { void harness.current.applyStyling({ outfit: { productId: 'emerald-blouse', title: 'Emerald Blouse' } }) })

      // Call count must strictly remain 1!
      expect(fetchSpy).toHaveBeenCalledTimes(3)

      // Resolve the pending job
      await act(async () => {
        resolvePromise({
          ok: true,
          json: async () => ({
            status: 'done',
            result: { key: 'done-key', imageUrl: '/done.png' },
          }),
        } as Response)
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

      expect(html).toContain('Applying styling…')
      expect(html).toContain('aria-label="Optional styling"')
      const disabledCount = (html.match(/disabled=""/g) || []).length
      expect(disabledCount).toBeGreaterThanOrEqual(4)
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
      expect(html).toContain('Switch to the other ear')
      expect(html).toContain('Upload a new photo')
    })

    it('3.2 NECK_NOT_VISIBLE displays COLLARBONE guidance, retry, and demo sample actions', () => {
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

      expect(html).toContain('Collarbone')
      expect(html).toContain('Try-on needs adjustment')
      expect(html).toContain('Face the camera straight on with your neck and collarbones visible.')
      expect(html).toContain('Try again')
      expect(html).toContain('Try the sample')
    })

    it('3.3 BUDGET_RESERVED displays quota guidance and a demo sample action', () => {
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
      expect(html).toContain('Try the sample')
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

      expect(html).toContain('Preview guidance')
      expect(html).toContain('Try-on needs adjustment')
      expect(html).toContain('Pipeline could not complete render within tolerance.')
      expect(html).toContain('Try again')
      expect(html).toContain('Try the sample')
    })

    it('3.5 EAR_NOT_VISIBLE changes the ear and requires explicit submission', async () => {
      const tryOnBodies: Array<Record<string, unknown>> = []
      const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith('/api/photo/upload')) return { ok: true, json: async () => ({}) } as Response
        if (String(input).endsWith('/api/photo')) return { ok: true, json: async () => ({ photoId: 'uploaded-personal-photo', width: 1000, height: 1200 }) } as Response
        if (String(input).endsWith('/api/tryon')) tryOnBodies.push(JSON.parse(String(init?.body)))
        return { ok: false, json: async () => ({ code: 'EAR_NOT_VISIBLE', userMessage: 'Turn your head slightly and tuck your hair behind your ear.' }) } as Response
      })
      global.fetch = fetchSpy

      const harness = renderHookHarness(() => useTryOn({ product: MOCK_PRODUCT }))
      await uploadPersonalPhoto(harness)
      act(() => harness.current.setEar('right'))
      expect(harness.current.state.ear).toBe('right')

      await act(async () => {
        await harness.current.submitTryOn()
      })

      expect(harness.current.state.step).toBe('error')
      expect(harness.current.state.error?.code).toBe('EAR_NOT_VISIBLE')
      expect(harness.current.state.error?.recoveryAction).toBe('ear')

      // Switching sides is a user decision; retrying is a separate explicit action.
      act(() => harness.current.switchEar())
      expect(harness.current.state.ear).toBe('left')
      expect(harness.current.state.step).toBe('measure')
      expect(tryOnBodies).toHaveLength(1)

      await act(async () => harness.current.submitTryOn())
      expect(tryOnBodies).toHaveLength(2)
      expect(tryOnBodies[1].ear).toBe('left')
      expect(harness.current.state.step).toBe('error')

      harness.unmount()
    })

    it('3.6 sample selection is immediate and reupload clears its temporary state', () => {
      const fetchSpy = vi.fn()
      global.fetch = fetchSpy
      const harness = renderHookHarness(() => useTryOn({ product: MOCK_PRODUCT }))

      act(() => {
        harness.current.selectSampleFace()
      })
      expect(harness.current.state.photoId).toBeDefined()
      expect(harness.current.state.step).toBe('result')
      expect(fetchSpy).not.toHaveBeenCalled()

      act(() => {
        harness.current.reupload()
      })

      expect(harness.current.state.step).toBe('photo')
      expect(harness.current.state.photoId).toBeNull()
      expect(harness.current.state.photoUrl).toBeNull()
      expect(harness.current.state.error).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()

      harness.unmount()
    })
  })
})
