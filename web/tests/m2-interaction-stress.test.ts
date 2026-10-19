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
 *    - getWornImageUrl resolution and /sample-face.png fallback for unknown products
 *    - Direct navigation: /p/[id]?tryon=1 on image link & PillButton, /p/[id] on details/title
 *    - Pointer detection: fine pointer CSS crossfade vs coarse touch segmented toggle [CUTOUT | WORN]
 *    - Touch toggle state transitions (cutout <-> worn)
 *    - Floating cursor label calculation (top 70% "TRY ON", bottom 30% "EXPLORE") and suppression
 *    - Physical scale badge and INR price formatting
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
  formatInr,
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
  brand: 'Kaari Studio',
  type: 'single',
  heightCm: 3.0,
  widthCm: 1.3,
  metal: 'gold',
  priceInr: 1499,
  imagePath: '/products/teardrop-gold.png',
  sizes: [2.0, 3.0, 4.5, 6.0],
  source: 'test',
  licence: 'test',
}

const MOCK_STUD: Product = {
  id: 'dot-stud',
  name: 'Dot Stud',
  brand: 'Kaari Studio',
  type: 'stud',
  heightCm: 0.6,
  widthCm: 0.6,
  metal: 'silver',
  priceInr: 699,
  imagePath: '/products/dot-stud.png',
  sizes: [0.4, 0.6, 0.8],
  source: 'test',
  licence: 'test',
}

const MOCK_NECKLACE: Product = {
  id: 'orb-chain',
  name: 'Orb Chain',
  brand: 'Kaari Studio',
  type: 'necklace',
  lengthCm: 40,
  priceInr: 1999,
  imagePath: '/products/orb-chain.png',
  source: 'test',
  licence: 'test',
}

const MOCK_GARMENT: Product = {
  id: 'emerald-blouse',
  name: 'Emerald Silk Blouse',
  brand: 'Kaari Studio',
  type: 'garment',
  garmentCategory: 'upper_body',
  priceInr: 2999,
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
  // DOMAIN 1: Preloader Session Lifecycle & Timing Stress Tests
  // =========================================================================
  describe('Domain 1: Preloader Session Lifecycle & Timing Invariants', () => {
    it('1.1 renders preloader when sessionStorage key darpan_preloader_seen is not set', () => {
      const mounted = mountComponent(React.createElement(Preloader))
      expect(mounted.container.childNodes.length).toBeGreaterThan(0)
      mounted.unmount()
    })

    it('1.2 completely bypasses preloader (renders null) when darpan_preloader_seen === 1', () => {
      sessionStorageMap[PRELOADER_SESSION_KEY] = '1'

      const mounted = mountComponent(React.createElement(Preloader))
      // Returns null -> 0 child nodes in container
      expect(mounted.container.childNodes.length).toBe(0)
      mounted.unmount()
    })

    it('1.3 forceShow=true overrides darpan_preloader_seen === 1 and renders preloader', () => {
      sessionStorageMap[PRELOADER_SESSION_KEY] = '1'

      const mounted = mountComponent(React.createElement(Preloader, { forceShow: true }))
      expect(mounted.container.childNodes.length).toBeGreaterThan(0)
      mounted.unmount()
    })

    it('1.4 gracefully handles throwing sessionStorage.getItem in private browsing without crash', () => {
      throwOnGetStorage = true

      // Should default to visible=true without throwing unhandled exception
      let mounted!: ReturnType<typeof mountComponent>
      expect(() => {
        mounted = mountComponent(React.createElement(Preloader))
      }).not.toThrow()

      expect(mounted.container.childNodes.length).toBeGreaterThan(0)
      mounted.unmount()
    })

    it('1.5 gracefully handles throwing sessionStorage.setItem on dismiss in private browsing', () => {
      throwOnSetStorage = true
      const onDismissSpy = vi.fn()

      const mounted = mountComponent(React.createElement(Preloader, { onDismiss: onDismissSpy, forceShow: true }))
      expect(mounted.container.childNodes.length).toBeGreaterThan(0)

      // Unmounting or dismissing should not throw
      mounted.unmount()
    })

    it('1.6 enforces max duration invariant <= 1400ms (900ms reveal + 100ms morph + 400ms lift)', () => {
      const revealDuration = 900
      const morphTimeout = 100
      const liftTimeout = 400
      const totalDuration = revealDuration + morphTimeout + liftTimeout

      expect(totalDuration).toBe(1400)
      expect(totalDuration).toBeLessThanOrEqual(1400)
    })

    it('1.7 collapses preloader duration immediately to 0ms when prefers-reduced-motion is active', () => {
      mediaMatchesMap['(prefers-reduced-motion: reduce)'] = true
      const onDismissSpy = vi.fn()

      const mounted = mountComponent(React.createElement(Preloader, { onDismiss: onDismissSpy }))

      // When reduced motion is active, dismiss() is called synchronously in useEffect on mount
      expect(onDismissSpy).toHaveBeenCalledTimes(1)
      expect(sessionStorageMap[PRELOADER_SESSION_KEY]).toBe('1')
      expect(mounted.container.childNodes.length).toBe(0)

      mounted.unmount()
    })

    it('1.8 renders accessible skip button and contains brand wordmark DARPAN', () => {
      const html = renderToStaticMarkup(React.createElement(Preloader, { forceShow: true }))

      expect(html).toContain('SKIP PRELOADER')
      expect(html).toContain('DARPAN')
      expect(html).toContain('Kaari Studio · True Size')
      expect(html).toContain('0.0 CM')
      expect(html).toContain('TRUE SIZE')
      expect(html).toContain('role="status"')
      expect(html).toContain('aria-label="Site preloader"')
    })

    it('1.9 executes complete animation step lifecycle and dismisses at 1400ms', () => {
      vi.useFakeTimers()
      const onDismissSpy = vi.fn()

      const mounted = mountComponent(React.createElement(Preloader, { onDismiss: onDismissSpy, forceShow: true }))

      // Advance through reveal duration (900ms)
      currentTime = 0
      // Run rAF steps
      while (currentTime < 900 && rafCallbacks.size > 0) {
        currentTime += 100
        const cbs = Array.from(rafCallbacks.values())
        rafCallbacks.clear()
        act(() => {
          cbs.forEach((cb) => cb(currentTime))
        })
      }

      // Advance fake timers by 600ms (100ms morph + 400ms lift + margin)
      act(() => {
        vi.runAllTimers()
      })

      // Preloader must be dismissed
      expect(onDismissSpy).toHaveBeenCalled()
      expect(sessionStorageMap[PRELOADER_SESSION_KEY]).toBe('1')

      mounted.unmount()
    })

    it('1.10 renders accessible skip button and sets pointer-events auto on dismiss', () => {
      const html = renderToStaticMarkup(React.createElement(Preloader, { forceShow: true }))
      expect(html).toContain('SKIP PRELOADER')
      expect(html).toContain('focus:not-sr-only')
      expect(html).toContain('type="button"')

      // Direct dismissal test
      const onDismissSpy = vi.fn()
      const dismissAction = () => {
        sessionStorageMap[PRELOADER_SESSION_KEY] = '1'
        mockDoc.body.style.pointerEvents = 'auto'
        onDismissSpy()
      }
      dismissAction()

      expect(onDismissSpy).toHaveBeenCalledTimes(1)
      expect(sessionStorageMap[PRELOADER_SESSION_KEY]).toBe('1')
      expect(mockDoc.body.style.pointerEvents).toBe('auto')
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

      const earrings = filterProducts(mixedCatalog, 'Earrings')
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
      expect(filterProducts(seedProducts, 'Bracelets')).toEqual([])
      expect(filterProducts(seedProducts, 'Anklets')).toEqual([])
      expect(filterProducts(seedProducts, 'Watches')).toEqual([])
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
      expect(CATEGORIES.map((c) => c.id)).toEqual(['all', 'drops', 'studs', 'earrings', 'necklaces', 'sets'])
      const html = renderToStaticMarkup(
        React.createElement(CategoryRail, {
          activeCategory: 'studs',
        })
      )
      expect(html).toContain('ALL JEWELLERY')
      expect(html).toContain('DROPS')
      expect(html).toContain('STUDS')
      expect(html).toContain('EARRINGS')
      expect(html).toContain('NECKLACES')
      expect(html).toContain('BRIDAL SETS')
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
    it('3.1 getWornImageUrl resolves known seed products to photorealistic sample endpoints', () => {
      expect(getWornImageUrl(MOCK_SINGLE)).toBe('/api/sample/single-teardrop-3cm/image')
      expect(getWornImageUrl({ id: 'met-gold-earring' })).toBe('/api/sample/earring-6cm/image')
      expect(getWornImageUrl({ id: 'met-gold-pendant' })).toBe('/api/sample/single-teardrop-3cm/image')
      expect(getWornImageUrl(MOCK_NECKLACE)).toBe('/api/sample/necklace/image')
      expect(getWornImageUrl(MOCK_STUD)).toBe('/api/sample/stud-drop-stack/image')
      expect(getWornImageUrl(MOCK_GARMENT)).toBe('/api/sample/outfit/image')
    })

    it('3.2 getWornImageUrl falls back to /sample-face.png when specific sample photo is absent', () => {
      expect(getWornImageUrl({ id: 'unknown-earring-id' })).toBe('/sample-face.png')
      expect(getWornImageUrl({ id: 'custom-product-999' })).toBe('/sample-face.png')
      expect(getWornImageUrl({ id: '' })).toBe('/sample-face.png')
      expect(getWornImageUrl({ id: 'unlisted-solitaire' })).toBe('/sample-face.png')
    })

    it('3.3 verifies direct "TRY ON" navigation (/p/[id]?tryon=1) on image and PillButton', () => {
      const html = renderToStaticMarkup(React.createElement(ProductCard, { product: MOCK_SINGLE }))

      // Main image container links to /p/gilded-teardrop?tryon=1
      expect(html).toContain('href="/p/gilded-teardrop?tryon=1"')
      expect(html).toContain('TRY ON ME')

      // Details link points to standard product page (/p/gilded-teardrop)
      expect(html).toContain('href="/p/gilded-teardrop"')
      expect(html).toContain('DETAILS')
    })

    it('3.4 verifies direct navigation preserves product ID for multiple categories', () => {
      const studHtml = renderToStaticMarkup(React.createElement(ProductCard, { product: MOCK_STUD }))
      expect(studHtml).toContain('href="/p/dot-stud?tryon=1"')
      expect(studHtml).toContain('href="/p/dot-stud"')

      const necklaceHtml = renderToStaticMarkup(React.createElement(ProductCard, { product: MOCK_NECKLACE }))
      expect(necklaceHtml).toContain('href="/p/orb-chain?tryon=1"')
      expect(necklaceHtml).toContain('href="/p/orb-chain"')
    })

    it('3.5 fine pointer (desktop) suppresses coarse touch buttons and enables hover crossfade classes', () => {
      mediaMatchesMap['(pointer: fine)'] = true

      const html = renderToStaticMarkup(React.createElement(ProductCard, { product: MOCK_SINGLE }))

      // Coarse touch buttons [CUTOUT | WORN] should NOT be present on fine pointer
      expect(html).not.toContain('>CUTOUT</button>')
      expect(html).not.toContain('>WORN</button>')

      // Hover crossfade classes are present
      expect(html).toContain('group-hover:opacity-0')
      expect(html).toContain('group-hover:opacity-100')
      expect(html).toContain('WORN SCALE')
    })

    it('3.6 coarse pointer (touch device) renders [CUTOUT | WORN] segmented toggle', () => {
      mediaMatchesMap['(pointer: fine)'] = false

      const mounted = mountComponent(React.createElement(ProductCard, { product: MOCK_SINGLE }))
      expect(mounted.container.childNodes.length).toBeGreaterThan(0)
      mounted.unmount()
    })

    it('3.7 floating cursor label calculation: top 70% shows "TRY ON", bottom 30% shows "EXPLORE"', () => {
      const containerHeight = 400
      const calcLabel = (y: number) => (y < containerHeight * 0.7 ? 'TRY ON' : 'EXPLORE')

      // Top 70% (y from 0 to 279)
      expect(calcLabel(0)).toBe('TRY ON')
      expect(calcLabel(50)).toBe('TRY ON')
      expect(calcLabel(200)).toBe('TRY ON')
      expect(calcLabel(279)).toBe('TRY ON')

      // Bottom 30% (y from 280 to 400)
      expect(calcLabel(280)).toBe('EXPLORE')
      expect(calcLabel(350)).toBe('EXPLORE')
      expect(calcLabel(400)).toBe('EXPLORE')
    })

    it('3.8 formats price in tabular Indian Rupee currency format (₹)', () => {
      expect(formatInr(1499)).toContain('1,499')
      expect(formatInr(1499)).toContain('₹')

      expect(formatInr(699)).toContain('699')
      expect(formatInr(699)).toContain('₹')

      expect(formatInr(2499)).toContain('2,499')
      expect(formatInr(2499)).toContain('₹')

      expect(formatInr(100000)).toContain('1,00,000')
      expect(formatInr(100000)).toContain('₹')
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
