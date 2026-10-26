import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import ReactDOM from 'react-dom/client'
import './dom-polyfill'
import { createMockElement, mockDoc } from './dom-polyfill'
import {
  setBackgroundInert,
  getActiveDrawerCount,
  resetDrawerInert,
} from '@/lib/focus-containment'
import { useInertBackground } from '@/hooks/useInertBackground'

// Realistic Mock DOM element supporting attribute and classList inspection
function createTrackedElement(tag = 'div') {
  const attributes = new Map<string, string>()
  const classListSet = new Set<string>()

  return {
    tagName: tag.toUpperCase(),
    attributes,
    setAttribute(name: string, val: string) {
      attributes.set(name, String(val))
    },
    removeAttribute(name: string) {
      attributes.delete(name)
    },
    hasAttribute(name: string) {
      return attributes.has(name)
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null
    },
    classList: {
      add(cls: string) {
        classListSet.add(cls)
      },
      remove(cls: string) {
        classListSet.delete(cls)
      },
      contains(cls: string) {
        return classListSet.has(cls)
      },
      values() {
        return Array.from(classListSet)
      },
    },
  }
}

// React Hook testing harness
function renderHookHarness<P, R>(hookFn: (props: P) => R, initialProps: P) {
  let latestResult!: R
  let currentProps = initialProps

  function TestComponent({ props }: { props: P }) {
    latestResult = hookFn(props)
    return null
  }

  const container = createMockElement('div')
  container.ownerDocument = mockDoc
  const root = ReactDOM.createRoot(container)

  act(() => {
    root.render(React.createElement(TestComponent, { props: currentProps }))
  })

  return {
    get current() {
      return latestResult
    },
    rerender(newProps: P) {
      currentProps = newProps
      act(() => {
        root.render(React.createElement(TestComponent, { props: currentProps }))
      })
    },
    unmount() {
      act(() => {
        root.unmount()
      })
    },
  }
}

describe('Empirical Adversarial Stress Suite: Reference-Counted Focus Containment', () => {
  let mockPageRoot: any
  let mockHeader: any
  let mockMain: any
  let originalDocument: any

  beforeEach(() => {
    resetDrawerInert()
    originalDocument = (global as any).document

    mockPageRoot = createTrackedElement('div')
    mockHeader = createTrackedElement('header')
    mockMain = createTrackedElement('main')

    ;(global as any).document = {
      getElementById: (id: string) => (id === 'page-root' ? mockPageRoot : null),
      querySelector: (sel: string) => {
        if (sel === 'header') return mockHeader
        if (sel === 'main') return mockMain
        return null
      },
    }
  })

  afterEach(() => {
    resetDrawerInert()
    ;(global as any).document = originalDocument
  })

  // -------------------------------------------------------------------------
  // 1. Multi-Drawer Stacking & Close Permutations
  // -------------------------------------------------------------------------
  describe('1. Multi-Drawer Stacking & Close Order Invariants', () => {
    it('1.1 TryOnDrawer -> CartDrawer: Cart closes first, verifies #page-root and <header> remain inert', () => {
      // Step 1: Open TryOn drawer
      setBackgroundInert('tryon-drawer', true)
      expect(getActiveDrawerCount()).toBe(1)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)
      expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(true)
      expect(mockHeader.hasAttribute('inert')).toBe(true)

      // Step 2: Open Cart drawer while TryOn drawer is still open
      setBackgroundInert('cart-drawer', true)
      expect(getActiveDrawerCount()).toBe(2)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)
      expect(mockHeader.hasAttribute('inert')).toBe(true)

      // Step 3: Close Cart drawer (TryOn still active)
      setBackgroundInert('cart-drawer', false)
      expect(getActiveDrawerCount()).toBe(1)
      // BACKGROUND MUST REMAIN INERT!
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)
      expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(true)
      expect(mockHeader.hasAttribute('inert')).toBe(true)

      // Step 4: Close TryOn drawer
      setBackgroundInert('tryon-drawer', false)
      expect(getActiveDrawerCount()).toBe(0)
      // Now all drawers are closed; inert must be stripped
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)
      expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(false)
      expect(mockHeader.hasAttribute('inert')).toBe(false)
    })

    it('1.2 TryOnDrawer -> CartDrawer: TryOn closes first, verifies inert remains until Cart closes', () => {
      setBackgroundInert('tryon-drawer', true)
      setBackgroundInert('cart-drawer', true)
      expect(getActiveDrawerCount()).toBe(2)

      // TryOn drawer closes or unmounts first
      setBackgroundInert('tryon-drawer', false)
      expect(getActiveDrawerCount()).toBe(1)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)
      expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(true)
      expect(mockHeader.hasAttribute('inert')).toBe(true)

      // Cart closes last
      setBackgroundInert('cart-drawer', false)
      expect(getActiveDrawerCount()).toBe(0)
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)
      expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(false)
      expect(mockHeader.hasAttribute('inert')).toBe(false)
    })

    it('1.3 Stacking of 4 drawers: tests all 24 (4!) closing permutation sequences', () => {
      const drawers = ['drawer-1', 'drawer-2', 'drawer-3', 'drawer-4']

      // Function to generate all permutations
      function getPermutations<T>(arr: T[]): T[][] {
        if (arr.length <= 1) return [arr]
        const result: T[][] = []
        for (let i = 0; i < arr.length; i++) {
          const current = arr[i]
          const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)]
          const remainingPerms = getPermutations(remaining)
          for (const perm of remainingPerms) {
            result.push([current, ...perm])
          }
        }
        return result
      }

      const permutations = getPermutations(drawers)
      expect(permutations).toHaveLength(24)

      for (const closeSequence of permutations) {
        resetDrawerInert()
        expect(getActiveDrawerCount()).toBe(0)

        // Open all 4 drawers
        for (const d of drawers) {
          setBackgroundInert(d, true)
        }
        expect(getActiveDrawerCount()).toBe(4)
        expect(mockPageRoot.hasAttribute('inert')).toBe(true)
        expect(mockHeader.hasAttribute('inert')).toBe(true)

        // Close in this specific permutation sequence
        for (let i = 0; i < closeSequence.length; i++) {
          const closingDrawer = closeSequence[i]
          setBackgroundInert(closingDrawer, false)
          const expectedRemaining = 3 - i

          expect(getActiveDrawerCount()).toBe(expectedRemaining)
          if (expectedRemaining > 0) {
            expect(mockPageRoot.hasAttribute('inert')).toBe(true)
            expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(true)
            expect(mockHeader.hasAttribute('inert')).toBe(true)
          } else {
            expect(mockPageRoot.hasAttribute('inert')).toBe(false)
            expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(false)
            expect(mockHeader.hasAttribute('inert')).toBe(false)
          }
        }
      }
    })
  })

  // -------------------------------------------------------------------------
  // 2. Idempotency, Duplicate Invocations & Negative Operations
  // -------------------------------------------------------------------------
  describe('2. Idempotency & Edge Conditions', () => {
    it('2.1 repeated open calls with the same drawerId do not artificially inflate refcount', () => {
      for (let i = 0; i < 10; i++) {
        setBackgroundInert('tryon-drawer', true)
      }

      // Set semantics should keep count at 1, NOT 10
      expect(getActiveDrawerCount()).toBe(1)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)

      // A single close call must successfully reset count to 0
      setBackgroundInert('tryon-drawer', false)
      expect(getActiveDrawerCount()).toBe(0)
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)
    })

    it('2.2 closing an un-opened / unregistered drawerId is safe and does not decrement into negative state', () => {
      expect(getActiveDrawerCount()).toBe(0)

      // Spurious close calls
      setBackgroundInert('phantom-drawer-1', false)
      setBackgroundInert('phantom-drawer-2', false)

      expect(getActiveDrawerCount()).toBe(0)
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)

      // Now open a real drawer
      setBackgroundInert('real-drawer', true)
      expect(getActiveDrawerCount()).toBe(1)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)

      // Another spurious close
      setBackgroundInert('phantom-drawer-3', false)
      expect(getActiveDrawerCount()).toBe(1)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)

      // Close real drawer
      setBackgroundInert('real-drawer', false)
      expect(getActiveDrawerCount()).toBe(0)
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)
    })

    it('2.3 resetDrawerInert completely clears state regardless of how many drawers were active', () => {
      setBackgroundInert('d1', true)
      setBackgroundInert('d2', true)
      setBackgroundInert('d3', true)
      expect(getActiveDrawerCount()).toBe(3)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)

      resetDrawerInert()
      expect(getActiveDrawerCount()).toBe(0)
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)
      expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(false)
      expect(mockHeader.hasAttribute('inert')).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 3. Fuzzing / Monte Carlo Random-Walk Oracle
  // -------------------------------------------------------------------------
  describe('3. Monte Carlo Invariant Oracle Stress Test', () => {
    it('3.1 maintains strict mathematical equivalence between activeDrawerIds > 0 and inert attributes across 1,000 random actions', () => {
      const drawerPool = ['tryon', 'cart', 'stylist', 'settings', 'filter', 'zoom', 'share']
      const activeTracking = new Set<string>()

      // Pseudorandom generator with fixed seed for deterministic reproducibility
      let seed = 42
      function pseudoRandom() {
        seed = (seed * 9301 + 49297) % 233280
        return seed / 233280
      }

      for (let step = 0; step < 1000; step++) {
        const drawerId = drawerPool[Math.floor(pseudoRandom() * drawerPool.length)]
        const shouldBeInert = pseudoRandom() > 0.45 // slight bias to opening

        if (shouldBeInert) {
          activeTracking.add(drawerId)
        } else {
          activeTracking.delete(drawerId)
        }

        setBackgroundInert(drawerId, shouldBeInert)

        // ORACLE INVARIANT VERIFICATION:
        const expectedCount = activeTracking.size
        const expectedInert = expectedCount > 0

        expect(getActiveDrawerCount()).toBe(expectedCount)
        expect(mockPageRoot.hasAttribute('inert')).toBe(expectedInert)
        expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(expectedInert)
        expect(mockHeader.hasAttribute('inert')).toBe(expectedInert)
      }

      // Cleanup
      resetDrawerInert()
      expect(getActiveDrawerCount()).toBe(0)
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 4. React useInertBackground Lifecycle Integration
  // -------------------------------------------------------------------------
  describe('4. React Hook useInertBackground Integration', () => {
    it('4.1 manages inert lifecycle across multiple concurrently mounted React components', () => {
      // Simulate TryOnDrawer
      const tryonHarness = renderHookHarness(
        ({ drawerId, isOpen }: { drawerId: string; isOpen: boolean }) => {
          useInertBackground(drawerId, isOpen)
        },
        { drawerId: 'tryon-drawer', isOpen: false }
      )

      // Simulate CartDrawer
      const cartHarness = renderHookHarness(
        ({ drawerId, isOpen }: { drawerId: string; isOpen: boolean }) => {
          useInertBackground(drawerId, isOpen)
        },
        { drawerId: 'cart-drawer', isOpen: false }
      )

      expect(getActiveDrawerCount()).toBe(0)
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)

      // 1. TryOn opens
      tryonHarness.rerender({ drawerId: 'tryon-drawer', isOpen: true })
      expect(getActiveDrawerCount()).toBe(1)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)

      // 2. Cart opens
      cartHarness.rerender({ drawerId: 'cart-drawer', isOpen: true })
      expect(getActiveDrawerCount()).toBe(2)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)

      // 3. Cart closes
      cartHarness.rerender({ drawerId: 'cart-drawer', isOpen: false })
      expect(getActiveDrawerCount()).toBe(1)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)
      expect(mockHeader.hasAttribute('inert')).toBe(true)

      // 4. Cart unmounts completely while closed
      cartHarness.unmount()
      expect(getActiveDrawerCount()).toBe(1)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)

      // 5. TryOn closes
      tryonHarness.rerender({ drawerId: 'tryon-drawer', isOpen: false })
      expect(getActiveDrawerCount()).toBe(0)
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)

      tryonHarness.unmount()
    })

    it('4.2 component unmounting while open cleans up its refcount contribution without stranding inert', () => {
      const drawerAHarness = renderHookHarness(
        ({ isOpen }: { isOpen: boolean }) => {
          useInertBackground('drawer-a', isOpen)
        },
        { isOpen: true }
      )

      const drawerBHarness = renderHookHarness(
        ({ isOpen }: { isOpen: boolean }) => {
          useInertBackground('drawer-b', isOpen)
        },
        { isOpen: true }
      )

      expect(getActiveDrawerCount()).toBe(2)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)

      // Drawer B suddenly unmounts (e.g. page navigation or conditional unmount)
      drawerBHarness.unmount()
      expect(getActiveDrawerCount()).toBe(1)
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)

      // Drawer A unmounts
      drawerAHarness.unmount()
      expect(getActiveDrawerCount()).toBe(0)
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)
      expect(mockHeader.hasAttribute('inert')).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 5. DOM Absence and Resilience Edge Cases
  // -------------------------------------------------------------------------
  describe('5. DOM Edge Cases & Environment Defenses', () => {
    it('5.1 falls back to <main> when #page-root is absent', () => {
      ;(global as any).document.getElementById = () => null

      setBackgroundInert('fallback-test', true)
      expect(mockMain.hasAttribute('inert')).toBe(true)
      expect(mockMain.classList.contains('page-under-drawer')).toBe(true)
      expect(mockHeader.hasAttribute('inert')).toBe(true)

      setBackgroundInert('fallback-test', false)
      expect(mockMain.hasAttribute('inert')).toBe(false)
      expect(mockMain.classList.contains('page-under-drawer')).toBe(false)
      expect(mockHeader.hasAttribute('inert')).toBe(false)
    })

    it('5.2 handles absence of header gracefully without breaking pageRoot inert', () => {
      ;(global as any).document.querySelector = (sel: string) => {
        if (sel === 'header') return null
        return null
      }

      expect(() => setBackgroundInert('no-header-test', true)).not.toThrow()
      expect(mockPageRoot.hasAttribute('inert')).toBe(true)

      expect(() => setBackgroundInert('no-header-test', false)).not.toThrow()
      expect(mockPageRoot.hasAttribute('inert')).toBe(false)
    })

    it('5.3 handles absence of both pageRoot and header without error', () => {
      ;(global as any).document.getElementById = () => null
      ;(global as any).document.querySelector = () => null

      expect(() => setBackgroundInert('empty-dom', true)).not.toThrow()
      expect(getActiveDrawerCount()).toBe(1)

      expect(() => setBackgroundInert('empty-dom', false)).not.toThrow()
      expect(getActiveDrawerCount()).toBe(0)
    })

    it('5.4 tolerates elements lacking setAttribute or classList functions without crashing', () => {
      ;(global as any).document.getElementById = () => ({}) // bare object
      ;(global as any).document.querySelector = () => ({}) // bare object

      expect(() => setBackgroundInert('bare-obj', true)).not.toThrow()
      expect(getActiveDrawerCount()).toBe(1)

      expect(() => setBackgroundInert('bare-obj', false)).not.toThrow()
      expect(getActiveDrawerCount()).toBe(0)
    })
  })
})
