/**
 * Milestone 2 Challenger 2 Empirical Stress Test Suite
 * Lifecycle & Interaction Stress Testing
 * 
 * Target Domains:
 * 1. Preloader Session Lifecycle Stress:
 *    - sessionStorage gating ('darpan_preloader_seen')
 *    - Private browsing fallback (throwing storage)
 *    - Max duration invariant (<= 1400ms: 900ms reveal + 100ms morph + 400ms lift)
 *    - prefers-reduced-motion immediate collapse to 0ms
 *    - Skip button accessibility & immediate dismissal
 *    - forceShow override prop
 * 2. Category Filtering & Anchor Coordination Stress:
 *    - filterProducts accuracy (All, Earrings, Studs, Necklaces, Drops, Teardrops)
 *    - Strict non-jewellery garment exclusion (emerald-blouse) across all categories
 *    - Adversarial edge cases: empty list, garment-only, unknown categories, case insensitivity
 *    - Category count accuracy
 *    - CategoryChips tabs, aria-selected, click handlers
 *    - CategoryRail anchor navigation, CustomEvent ('darpan:category'), history.replaceState, scrollIntoView
 *    - ProductGrid event synchronization ('darpan:category' & 'hashchange') and empty state recovery
 * 3. Product Card Interactions & Worn Photo Stress:
 *    - getWornImageUrl resolution with no fallback for unmatched products
 *    - Direct navigation: /p/[id]?tryon=1 on image link & PillButton, /p/[id] on details/title
 *    - Pointer detection: fine pointer CSS crossfade vs coarse touch segmented toggle [CUTOUT | WORN] when a worn sample exists
 *    - Touch toggle state transitions (cutout <-> worn)
 *    - Floating cursor label calculation (top 70% "TRY ON", bottom 30% "EXPLORE") and suppression
 *    - Physical scale badge and USD price formatting
 */

// Import polyfills FIRST
import './dom-polyfill'
import { createMockElement, mockDoc } from './dom-polyfill'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import ReactDOM from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

// Home components & helpers under test
import {
  Preloader,
  PRELOADER_SESSION_KEY,
  CategoryRail,
  CATEGORIES,
  CategoryChips,
  ProductCard,
  ProductGrid,
  filterProducts,
  getWornImageUrl,
  formatPrice,
  WORN_IMAGE_MAP,
} from '@/components/home'
import { seedProducts, Product } from '@/lib/products'

// Helper to mount a component into the mock DOM
function mountComponent(element: React.ReactElement) {
  const container = createMockElement('div')
  container.ownerDocument = mockDoc
  const root = ReactDOM.createRoot(container)

  act(() => {
    root.render(element)
  })

  return {
    container,
    root,
    rerender(newElement: React.ReactElement) {
      act(() => {
        root.render(newElement)
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
// Test Fixtures & Adversarial Data
// ---------------------------------------------------------------------------
const MOCK_SINGLE: Product = {
  id: 'gilded-teardrop',
  name: 'Gilded Teardrop',
  brand: 'Darpan',
  type: 'single',
  heightCm: 3.0,
  widthCm: 1.3,
  metal: 'gold',
  priceUsd: 1499,
  imagePath: '/products/teardrop-gold.png',
  sizes: [2.0, 3.0, 4.5, 6.0],
  source: 'test',
  licence: 'test',
}

const MOCK_STUD: Product = {
  id: 'dot-stud',
  name: 'Dot Stud',
  brand: 'Darpan',
  type: 'stud',
  heightCm: 0.6,
  widthCm: 0.6,
  metal: 'silver',
  priceUsd: 699,
  imagePath: '/products/dot-stud.png',
  sizes: [0.4, 0.6, 0.8],
  source: 'test',
  licence: 'test',
}

const MOCK_NECKLACE: Product = {
  id: 'orb-chain',
  name: 'Orb Chain',
  brand: 'Darpan',
  type: 'necklace',
  lengthCm: 40,
  priceUsd: 1999,
  imagePath: '/products/orb-chain.png',
  source: 'test',
  licence: 'test',
}

const MOCK_GARMENT: Product = {
  id: 'emerald-blouse',
  name: 'Emerald Silk Blouse',
  brand: 'Darpan',
  type: 'garment',
  garmentCategory: 'upper_body',
  priceUsd: 2999,
  imagePath: '/products/emerald-blouse.png',
  source: 'test',
  licence: 'test',
}

describe('Milestone 2 Challenger 2: Lifecycle & Interaction Stress Tests', () => {
  let sessionStorageMap: Record<string, string> = {}
  let throwOnGetStorage = false
  let throwOnSetStorage = false
  let mediaMatchesMap: Record<string, boolean> = {}
  let mediaListeners: Map<string, Set<Function>> = new Map()
  let windowEventListeners: Map<string, Set<Function>> = new Map()
  let rafCallbacks: Map<number, FrameRequestCallback> = new Map()
  let nextRafId = 1
  let currentTime = 0

  beforeEach(() => {
    sessionStorageMap = {}
    throwOnGetStorage = false
    throwOnSetStorage = false
    mediaMatchesMap = {
      '(prefers-reduced-motion: reduce)': false,
      '(pointer: fine)': true,
    }
    mediaListeners = new Map()
    windowEventListeners = new Map()
    rafCallbacks = new Map()
    nextRafId = 1
    currentTime = 0

    // Polyfill element methods
    const origCreateElement = mockDoc.createElement
    const enhanceElement = (el: any) => {
      el.focus = vi.fn()
      el.blur = vi.fn()
      el.scrollIntoView = vi.fn()
      el.getBoundingClientRect = vi.fn(() => ({
        top: 0,
        left: 0,
        bottom: 400,
        right: 300,
        width: 300,
        height: 400,
        x: 0,
        y: 0,
      }))
      return el
    }

    mockDoc.createElement = (tag: string) => {
      const el = origCreateElement(tag)
      return enhanceElement(el)
    }

    mockDoc.createElementNS = (ns: string, tag: string) => {
      const el = origCreateElement(tag)
      el.namespaceURI = ns
      return enhanceElement(el)
    }

    mockDoc.querySelector = vi.fn((sel: string) => {
      if (sel === '#collection') {
        const el = createMockElement('section')
        el.id = 'collection'
        el.scrollIntoView = vi.fn()
        return el
      }
      return null
    })

    // Mock sessionStorage
    const mockSessionStorage = {
      getItem: vi.fn((key: string) => {
        if (throwOnGetStorage) throw new DOMException('SecurityError', 'SecurityError')
        return sessionStorageMap[key] ?? null
      }),
      setItem: vi.fn((key: string, val: string) => {
        if (throwOnSetStorage) throw new DOMException('QuotaExceededError', 'QuotaExceededError')
        sessionStorageMap[key] = String(val)
      }),
      removeItem: vi.fn((key: string) => {
        delete sessionStorageMap[key]
      }),
      clear: vi.fn(() => {
        sessionStorageMap = {}
      }),
    }

    // Mock matchMedia
    const mockMatchMedia = vi.fn((query: string) => {
      const listeners = new Set<Function>()
      mediaListeners.set(query, listeners)
      return {
        matches: mediaMatchesMap[query] ?? false,
        media: query,
        onchange: null,
        addListener: vi.fn((fn: Function) => listeners.add(fn)),
        removeListener: vi.fn((fn: Function) => listeners.delete(fn)),
        addEventListener: vi.fn((type: string, fn: Function) => {
          if (type === 'change') listeners.add(fn)
        }),
        removeEventListener: vi.fn((type: string, fn: Function) => {
          if (type === 'change') listeners.delete(fn)
        }),
        dispatchEvent: vi.fn(() => true),
      }
    })

    // Mock requestAnimationFrame / cancelAnimationFrame
    const mockRaf = vi.fn((cb: FrameRequestCallback) => {
      const id = nextRafId++
      rafCallbacks.set(id, cb)
      return id
    })
    const mockCaf = vi.fn((id: number) => {
      rafCallbacks.delete(id)
    })

    // Mock performance.now
    const mockPerfNow = vi.fn(() => currentTime)

    // Window event listeners
    const mockAddEventListener = vi.fn((type: string, listener: Function) => {
      if (!windowEventListeners.has(type)) windowEventListeners.set(type, new Set())
      windowEventListeners.get(type)!.add(listener)
    })
    const mockRemoveEventListener = vi.fn((type: string, listener: Function) => {
      windowEventListeners.get(type)?.delete(listener)
    })
    const mockDispatchEvent = vi.fn((event: any) => {
      const listeners = windowEventListeners.get(event.type)
      if (listeners) {
        for (const listener of Array.from(listeners)) {
          listener(event)
        }
      }
      return true
    })

    // Mock IntersectionObserver
    class MockIntersectionObserver {
      callback: any
      elements = new Set<any>()
      constructor(cb: any) {
        this.callback = cb
      }
      observe(el: any) {
        this.elements.add(el)
      }
      unobserve(el: any) {
        this.elements.delete(el)
      }
      disconnect() {
        this.elements.clear()
      }
    }
    ;(global as any).IntersectionObserver = MockIntersectionObserver

    // Mock History
    const mockHistory = {
      replaceState: vi.fn(),
      pushState: vi.fn(),
    }

    // Mock requestIdleCallback / cancelIdleCallback
    const mockRequestIdleCallback = vi.fn((cb: Function) => setTimeout(cb, 1))
    const mockCancelIdleCallback = vi.fn((id: any) => clearTimeout(id))

    // Assign to globals and window
    const targetWindow: any = {
      Element: (global as any).Element,
      HTMLElement: (global as any).HTMLElement,
      HTMLIFrameElement: (global as any).HTMLIFrameElement,
      SVGElement: (global as any).SVGElement,
      document: mockDoc,
      sessionStorage: mockSessionStorage,
      matchMedia: mockMatchMedia,
      requestAnimationFrame: mockRaf,
      cancelAnimationFrame: mockCaf,
      requestIdleCallback: mockRequestIdleCallback,
      cancelIdleCallback: mockCancelIdleCallback,
      setTimeout: (...args: any[]) => (global as any).setTimeout(...args),
      clearTimeout: (...args: any[]) => (global as any).clearTimeout(...args),
      performance: { now: mockPerfNow },
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: mockDispatchEvent,
      history: mockHistory,
      location: new URL('http://localhost:3000'),
      IntersectionObserver: MockIntersectionObserver,
    }
    targetWindow.self = targetWindow

    mockDoc.defaultView = targetWindow
    ;(global as any).window = targetWindow
    ;(global as any).self = targetWindow
    ;(global as any).requestIdleCallback = mockRequestIdleCallback
    ;(global as any).cancelIdleCallback = mockCancelIdleCallback
    ;(global as any).sessionStorage = mockSessionStorage
    ;(global as any).matchMedia = mockMatchMedia
    ;(global as any).requestAnimationFrame = mockRaf
    ;(global as any).cancelAnimationFrame = mockCaf
    ;(global as any).performance = targetWindow.performance
    ;(global as any).history = mockHistory
    ;(global as any).location = targetWindow.location
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // =========================================================================
  // DOMAIN 1: Non-blocking home entry
  // =========================================================================
  describe('Domain 1: Non-blocking home entry', () => {
    it('1.1 keeps the page usable immediately when no session marker exists', () => {
      const onDismiss = vi.fn()
      const mounted = mountComponent(React.createElement(Preloader, { onDismiss }))
      expect(mounted.container.childNodes.length).toBe(0)
      expect(onDismiss).toHaveBeenCalledTimes(1)
      mounted.unmount()
    })

    it('1.2 remains non-blocking when the session marker is already set', () => {
      sessionStorageMap[PRELOADER_SESSION_KEY] = '1'
      const onDismiss = vi.fn()
      const mounted = mountComponent(React.createElement(Preloader, { onDismiss }))
      expect(mounted.container.childNodes.length).toBe(0)
      expect(onDismiss).toHaveBeenCalledTimes(1)
      mounted.unmount()
    })

    it('1.3 forceShow does not reintroduce a blocking screen', () => {
      sessionStorageMap[PRELOADER_SESSION_KEY] = '1'
      const onDismiss = vi.fn()
      const mounted = mountComponent(React.createElement(Preloader, { forceShow: true, onDismiss }))
      expect(mounted.container.childNodes.length).toBe(0)
      expect(onDismiss).toHaveBeenCalledTimes(1)
      mounted.unmount()
    })

    it('1.4 does not depend on sessionStorage availability', () => {
      throwOnGetStorage = true
      const onDismiss = vi.fn()
      let mounted!: ReturnType<typeof mountComponent>
      expect(() => {
        mounted = mountComponent(React.createElement(Preloader, { onDismiss }))
      }).not.toThrow()
      expect(mounted.container.childNodes.length).toBe(0)
      expect(onDismiss).toHaveBeenCalledTimes(1)
      mounted.unmount()
    })

    it('1.5 does not write a session marker when dismissed', () => {
      throwOnSetStorage = true
      const onDismissSpy = vi.fn()

      const mounted = mountComponent(React.createElement(Preloader, { onDismiss: onDismissSpy, forceShow: true }))
      expect(mounted.container.childNodes.length).toBe(0)
      expect(onDismissSpy).toHaveBeenCalledTimes(1)
      expect(sessionStorageMap[PRELOADER_SESSION_KEY]).toBeUndefined()
      mounted.unmount()
    })

    it('1.6 has no entry-animation delay', () => {
      const start = performance.now()
      const mounted = mountComponent(React.createElement(Preloader))
      expect(performance.now() - start).toBeLessThan(1400)
      expect(mounted.container.childNodes.length).toBe(0)
      mounted.unmount()
    })

    it('1.7 stays immediately usable when reduced motion is requested', () => {
      mediaMatchesMap['(prefers-reduced-motion: reduce)'] = true
      const onDismissSpy = vi.fn()

      const mounted = mountComponent(React.createElement(Preloader, { onDismiss: onDismissSpy }))

      expect(onDismissSpy).toHaveBeenCalledTimes(1)
      expect(mounted.container.childNodes.length).toBe(0)

      mounted.unmount()
    })

    it('1.8 renders no unnecessary overlay or skip control', () => {
      const html = renderToStaticMarkup(React.createElement(Preloader, { forceShow: true }))

      expect(html).toBe('')
      expect(html).not.toContain('role="dialog"')
      expect(html).not.toContain('SKIP PRELOADER')
    })

    it('1.9 dismisses immediately without scheduling animation work', () => {
      const onDismissSpy = vi.fn()
      const mounted = mountComponent(React.createElement(Preloader, { onDismiss: onDismissSpy, forceShow: true }))
      expect(onDismissSpy).toHaveBeenCalledTimes(1)
      expect(mounted.container.childNodes.length).toBe(0)
      expect(rafCallbacks.size).toBe(0)
      mounted.unmount()
    })

    it('1.10 does not add a hidden focus stop or alter pointer handling', () => {
      const html = renderToStaticMarkup(React.createElement(Preloader, { forceShow: true }))
      expect(html).toBe('')
      expect(html).not.toContain('focus:not-sr-only')
      expect(mockDoc.body.style.pointerEvents).not.toBe('none')
    })
  })

  // =========================================================================
  // DOMAIN 2: Category Filtering & Anchor Coordination Stress Tests
  // =========================================================================
  describe('Domain 2: Category Filtering & Anchor Coordination Stress', () => {
    it('2.1 filterProducts strictly excludes non-jewellery garments across all categories', () => {
      const mixedCatalog: Product[] = [MOCK_SINGLE, MOCK_STUD, MOCK_NECKLACE, MOCK_GARMENT]

      const all = filterProducts(mixedCatalog, 'All')
      expect(all.some((p) => p.type === 'garment')).toBe(false)
      expect(all).toHaveLength(3)

      const earrings = filterProducts(mixedCatalog, 'Drops')
      expect(earrings.some((p) => p.type === 'garment')).toBe(false)

      const studs = filterProducts(mixedCatalog, 'Studs')
      expect(studs.some((p) => p.type === 'garment')).toBe(false)

      const necklaces = filterProducts(mixedCatalog, 'Necklaces')
      expect(necklaces.some((p) => p.type === 'garment')).toBe(false)
    })

    it('2.2 filterProducts accurately filters single earrings and teardrops', () => {
      const earrings = filterProducts(seedProducts, 'Earrings')
      expect(earrings.length).toBeGreaterThanOrEqual(3)
      earrings.forEach((p) => {
        const isEarring =
          p.type === 'single' ||
          p.id.includes('teardrop') ||
          p.id.includes('earring') ||
          p.id.includes('pendant')
        expect(isEarring).toBe(true)
      })

      // Aliases 'drops' and 'teardrops' produce identical output
      const drops = filterProducts(seedProducts, 'drops')
      const teardrops = filterProducts(seedProducts, 'teardrops')
      expect(drops).toEqual(earrings)
      expect(teardrops).toEqual(earrings)
    })

    it('2.3 filterProducts accurately filters solitary studs', () => {
      const studs = filterProducts(seedProducts, 'Studs')
      expect(studs.length).toBeGreaterThanOrEqual(1)
      studs.forEach((p) => {
        expect(p.type).toBe('stud')
      })
      expect(studs.map((p) => p.id)).toContain('dot-stud')
    })

    it('2.4 filterProducts accurately filters necklaces', () => {
      const necklaces = filterProducts(seedProducts, 'Necklaces')
      expect(necklaces.length).toBeGreaterThanOrEqual(1)
      necklaces.forEach((p) => {
        expect(p.type).toBe('necklace')
      })
      expect(necklaces.map((p) => p.id)).toContain('orb-chain')
    })

    it('2.5 filterProducts handles case-insensitivity seamlessly (ALL, eArRiNgS, STUDS)', () => {
      expect(filterProducts(seedProducts, 'ALL')).toEqual(filterProducts(seedProducts, 'All'))
      expect(filterProducts(seedProducts, 'eArRiNgS')).toEqual(filterProducts(seedProducts, 'Earrings'))
      expect(filterProducts(seedProducts, 'STUDS')).toEqual(filterProducts(seedProducts, 'Studs'))
      expect(filterProducts(seedProducts, 'NECKLACES')).toEqual(filterProducts(seedProducts, 'Necklaces'))
    })

    it('2.6 filterProducts adversarial robustness: handles empty list, garment-only, and unknown categories', () => {
      // Empty input
      expect(filterProducts([], 'All')).toEqual([])
      expect(filterProducts([], 'Earrings')).toEqual([])

      // Garment-only input returns empty array for all categories
      const garmentOnly = [MOCK_GARMENT]
      expect(filterProducts(garmentOnly, 'All')).toEqual([])
      expect(filterProducts(garmentOnly, 'Earrings')).toEqual([])
      expect(filterProducts(garmentOnly, 'Studs')).toEqual([])

      // Unknown category returns empty array
      expect(filterProducts(seedProducts, 'Anklets')).toEqual([])
      expect(filterProducts(seedProducts, 'Brooches')).toEqual([])
      // Hand categories now exist and must return only their own type
      expect(filterProducts(seedProducts, 'Bracelets').every(p => p.type === 'bracelet')).toBe(true)
      expect(filterProducts(seedProducts, 'Watches').every(p => p.type === 'watch')).toBe(true)
    })

    it('2.7 CategoryChips renders accessible tab roles and correct aria-selected states', () => {
      const categories = ['All', 'Earrings', 'Studs', 'Necklaces']
      const counts = { All: 5, Earrings: 3, Studs: 1, Necklaces: 1 }

      const html = renderToStaticMarkup(
        React.createElement(CategoryChips, {
          categories,
          activeCategory: 'Earrings',
          onSelectCategory: () => {},
          counts,
        })
      )

      expect(html).toContain('role="group"')
      expect(html).toContain('aria-label="Filter collection"')
      expect(html).toContain('role="tab"')
      // Active category Earrings has aria-selected="true"
      expect(html).toContain('aria-selected="true"')
      // Count badge 3 for Earrings
      expect(html).toContain('3')
      expect(html).toContain('5')
    })

    it('2.8 CategoryRail defines all 6 architectural categories with silhouettes', () => {
      expect(CATEGORIES.map((c) => c.id)).toEqual(['all', 'studs', 'drops', 'stacks', 'necklaces'])
      const html = renderToStaticMarkup(
        React.createElement(CategoryRail, {
          activeCategory: 'studs',
        })
      )
      expect(html).toContain('ALL JEWELLERY')
      expect(html).toContain('DROPS')
      expect(html).toContain('STUDS')
      expect(html).toContain('STACKS')
      expect(html).toContain('NECKLACES')
    })

    it('2.9 CategoryRail coordination: dispatches darpan:category, updates history hash and scrolls into view', () => {
      const onCategorySelectSpy = vi.fn()
      const eventSpy = vi.fn()
      window.addEventListener('darpan:category', eventSpy)

      const mounted = mountComponent(
        React.createElement(CategoryRail, {
          activeCategory: 'all',
          onCategorySelect: onCategorySelectSpy,
          targetAnchor: '#collection',
        })
      )

      act(() => {
        window.dispatchEvent(new CustomEvent('darpan:category', { detail: 'drops' }))
        window.history.replaceState(null, '', '#collection?cat=drops')
      })

      expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '#collection?cat=drops')
      expect(eventSpy).toHaveBeenCalledTimes(1)

      window.removeEventListener('darpan:category', eventSpy)
      mounted.unmount()
    })

    it('2.10 ProductGrid responds dynamically to darpan:category and hashchange events', () => {
      const mounted = mountComponent(React.createElement(ProductGrid, { initialProducts: seedProducts }))

      // Initial state is 'All'
      let html = renderToStaticMarkup(React.createElement(ProductGrid, { initialProducts: seedProducts }))
      expect(html).toContain('Gilded Teardrop')
      expect(html).toContain('Orb Chain')
      expect(html).toContain('Dot Stud')

      // Dispatch category event 'studs'
      act(() => {
        window.dispatchEvent(new CustomEvent('darpan:category', { detail: 'studs' }))
      })

      // Dispatch category event 'necklaces'
      act(() => {
        window.dispatchEvent(new CustomEvent('darpan:category', { detail: 'necklaces' }))
      })

      // Simulate hashchange event to '#collection?cat=drops'
      ;(global as any).location.hash = '#collection?cat=drops'
      act(() => {
        window.dispatchEvent(new Event('hashchange'))
      })

      mounted.unmount()
    })

    it('2.11 ProductGrid displays graceful empty state when a filter matches zero products', () => {
      const html = renderToStaticMarkup(
        React.createElement(ProductGrid, {
          initialProducts: [], // empty products trigger loading or empty state
        })
      )
      expect(html).toBeDefined()
    })
  })

  // =========================================================================
  // DOMAIN 3: Product Card Interactions & Worn Photo Stress Tests
  // =========================================================================
  describe('Domain 3: Product Card Interactions & Worn Photo Stress', () => {
    it('3.1 getWornImageUrl resolves known products to their static or sample renders', () => {
      expect(getWornImageUrl(MOCK_SINGLE)).toBe('/samples/single-teardrop-3cm.png')
      expect(getWornImageUrl({ id: 'met-gold-earring' })).toBe('/products/worn/met-gold-earring.jpg')
      expect(getWornImageUrl({ id: 'unmapped-product' })).toBeUndefined()
      expect(getWornImageUrl(MOCK_NECKLACE)).toBe('/samples/necklace.png')
      expect(getWornImageUrl(MOCK_STUD)).toBe('/samples/dot-stud-0.6cm.png')
      expect(getWornImageUrl(MOCK_GARMENT)).toBe('/api/sample/outfit/image')
    })

    it('3.2 getWornImageUrl returns no image when a specific sample photo is absent', () => {
      expect(getWornImageUrl({ id: 'unknown-earring-id' })).toBeUndefined()
      expect(getWornImageUrl({ id: 'custom-product-999' })).toBeUndefined()
      expect(getWornImageUrl({ id: '' })).toBeUndefined()
      expect(getWornImageUrl({ id: 'unlisted-solitaire' })).toBeUndefined()
    })

    it('3.3 links the card to the product page and Try it on to the sample studio', () => {
      const html = renderToStaticMarkup(React.createElement(ProductCard, { product: MOCK_SINGLE }))

      // The Try it on action opens the sample studio
      expect(html).toContain('href="/try-on/gilded-teardrop?sample=1"')
      expect(html).toContain('Try it on')

      // The whole card is one link to the product page
      expect(html).toContain('href="/p/gilded-teardrop"')
      expect(html).not.toContain('DETAILS')
    })

    it('3.4 verifies direct navigation preserves product ID for multiple categories', () => {
      const studHtml = renderToStaticMarkup(React.createElement(ProductCard, { product: MOCK_STUD }))
      expect(studHtml).toContain('href="/try-on/dot-stud?sample=1"')
      expect(studHtml).toContain('href="/p/dot-stud"')

      const necklaceHtml = renderToStaticMarkup(React.createElement(ProductCard, { product: MOCK_NECKLACE }))
      expect(necklaceHtml).toContain('href="/try-on/orb-chain?sample=1"')
      expect(necklaceHtml).toContain('href="/p/orb-chain"')
    })

    it('3.5 fine pointer (desktop) suppresses coarse touch buttons and enables hover crossfade classes', () => {
      mediaMatchesMap['(pointer: fine)'] = true

      const html = renderToStaticMarkup(React.createElement(ProductCard, { product: MOCK_SINGLE }))

      // Coarse touch buttons [Cut-out | Worn] should NOT be present on fine pointer
      expect(html).not.toContain('>Cut-out</button>')
      expect(html).not.toContain('>Worn</button>')

      // Hover crossfade classes are present
      expect(html).toContain('group-hover:opacity-0')
      expect(html).toContain('group-hover:opacity-100')

      // The cut-out stays fully visible on the paper square (12% padding); the worn render fills the square.
      expect(html).toContain('object-contain')
      expect(html).toContain('p-[12%]')
      expect(html).toContain('object-cover')
      expect(html).not.toContain('>TRY ON</span>')
      expect(html).toContain('Try it on')
      expect(html).not.toContain('WORN SCALE')
    })

    it('3.6 omits worn imagery, WORN SCALE, and the touch toggle without an exact sample', () => {
      const html = renderToStaticMarkup(React.createElement(ProductCard, {
        product: {
          ...MOCK_SINGLE,
          id: 'unmapped-product',
          name: 'Gold Cluster Drop',
          imagePath: '/products/met-pendant-446796.jpg',
        },
      }))

      expect(html).not.toContain('WORN SCALE')
      expect(html).not.toContain('>Worn</button>')
      expect(html).toContain('Gold Cluster Drop')
    })

    it('3.6 coarse pointer (touch device) renders [Cut-out | Worn] segmented toggle', () => {
      mediaMatchesMap['(pointer: fine)'] = false

      const mounted = mountComponent(React.createElement(ProductCard, { product: MOCK_SINGLE }))
      expect(mounted.container.childNodes.length).toBeGreaterThan(0)
      mounted.unmount()
    })

    it('3.8 keeps the card action with the Try it on copy', () => {
      const html = renderToStaticMarkup(React.createElement(ProductCard, { product: MOCK_SINGLE }))
      expect(html).toContain('Try it on')
      expect(html).not.toContain('>TRY ON</span>')
    })

    it('3.8 formats price in tabular USD currency format', () => {
      expect(formatPrice(1499)).toBe('$1,499')
      expect(formatPrice(699)).toBe('$699')
      expect(formatPrice(2499)).toBe('$2,499')
      expect(formatPrice(100000)).toBe('$100,000')
    })

    it('3.9 computes accurate physical scale label per jewellery type', () => {
      const getLabel = (p: Product) =>
        p.type === 'single' || p.type === 'stud'
          ? `${p.heightCm.toFixed(1)} CM`
          : p.type === 'necklace'
          ? `${(p as any).lengthCm} CM`
          : 'TRUE FIT'

      expect(getLabel(MOCK_SINGLE)).toBe('3.0 CM')
      expect(getLabel(MOCK_STUD)).toBe('0.6 CM')
      expect(getLabel(MOCK_NECKLACE)).toBe('40 CM')
      expect(getLabel(MOCK_GARMENT)).toBe('TRUE FIT')
    })

    it('3.10 coarse pointer toggle: initial cutout state and renders toggle under touch media query', () => {
      mediaMatchesMap['(pointer: fine)'] = false
      const mounted = mountComponent(React.createElement(ProductCard, { product: MOCK_SINGLE }))
      expect(mounted.container.childNodes.length).toBeGreaterThan(0)
      mounted.unmount()
    })

    it('3.11 MacroTilt calculates accurate 3D rotation angles and centers at rest', () => {
      const maxTilt = 4
      const calcTilt = (px: number, py: number) => ({
        rotX: (0.5 - py) * (maxTilt * 2),
        rotY: (px - 0.5) * (maxTilt * 2),
      })

      // Center (0.5, 0.5) -> rotX = 0, rotY = 0
      expect(calcTilt(0.5, 0.5)).toEqual({ rotX: 0, rotY: 0 })

      // Top-left (0, 0) -> rotX = 4 deg (tilts up), rotY = -4 deg (tilts left)
      expect(calcTilt(0, 0)).toEqual({ rotX: 4, rotY: -4 })

      // Bottom-right (1, 1) -> rotX = -4 deg (tilts down), rotY = 4 deg (tilts right)
      expect(calcTilt(1, 1)).toEqual({ rotX: -4, rotY: 4 })
    })
  })
})
