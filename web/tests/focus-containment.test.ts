import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setBackgroundInert,
  getActiveDrawerCount,
  resetDrawerInert,
} from '@/lib/focus-containment'

function createTestElement() {
  const attributes = new Map<string, string>()
  const classListSet = new Set<string>()

  return {
    attributes,
    setAttribute(name: string, val: string) {
      attributes.set(name, val)
    },
    removeAttribute(name: string) {
      attributes.delete(name)
    },
    hasAttribute(name: string) {
      return attributes.has(name)
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
    },
  }
}

describe('Focus Containment & Inert Background Controller', () => {
  let mockPageRoot: any
  let mockHeader: any
  let mockMain: any
  let originalDocument: any

  beforeEach(() => {
    resetDrawerInert()
    originalDocument = (global as any).document

    mockPageRoot = createTestElement()
    mockHeader = createTestElement()
    mockMain = createTestElement()

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

  it('sets inert on #page-root and <header> and adds page-under-drawer class when drawer opens', () => {
    setBackgroundInert('tryon-drawer', true)

    expect(getActiveDrawerCount()).toBe(1)
    expect(mockPageRoot.hasAttribute('inert')).toBe(true)
    expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(true)
    expect(mockHeader.hasAttribute('inert')).toBe(true)
  })

  it('removes inert and page-under-drawer class when drawer closes', () => {
    setBackgroundInert('tryon-drawer', true)
    expect(mockPageRoot.hasAttribute('inert')).toBe(true)

    setBackgroundInert('tryon-drawer', false)
    expect(getActiveDrawerCount()).toBe(0)
    expect(mockPageRoot.hasAttribute('inert')).toBe(false)
    expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(false)
    expect(mockHeader.hasAttribute('inert')).toBe(false)
  })

  it('falls back to <main> when #page-root is absent in DOM', () => {
    ;(global as any).document.getElementById = () => null

    setBackgroundInert('drawer-fallback', true)

    expect(mockMain.hasAttribute('inert')).toBe(true)
    expect(mockMain.classList.contains('page-under-drawer')).toBe(true)
    expect(mockHeader.hasAttribute('inert')).toBe(true)

    setBackgroundInert('drawer-fallback', false)
    expect(mockMain.hasAttribute('inert')).toBe(false)
    expect(mockMain.classList.contains('page-under-drawer')).toBe(false)
  })

  it('maintains inert state when multiple drawers stack (tryon + cart)', () => {
    // 1. TryOn drawer opens
    setBackgroundInert('tryon-drawer', true)
    expect(getActiveDrawerCount()).toBe(1)
    expect(mockPageRoot.hasAttribute('inert')).toBe(true)

    // 2. Cart drawer opens while TryOn drawer is still open
    setBackgroundInert('cart-drawer', true)
    expect(getActiveDrawerCount()).toBe(2)
    expect(mockPageRoot.hasAttribute('inert')).toBe(true)

    // 3. User closes Cart drawer to return to TryOn drawer
    setBackgroundInert('cart-drawer', false)
    expect(getActiveDrawerCount()).toBe(1)
    // CRITICAL: Background must STILL be inert because tryon-drawer is still active!
    expect(mockPageRoot.hasAttribute('inert')).toBe(true)
    expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(true)
    expect(mockHeader.hasAttribute('inert')).toBe(true)

    // 4. Finally close TryOn drawer
    setBackgroundInert('tryon-drawer', false)
    expect(getActiveDrawerCount()).toBe(0)
    expect(mockPageRoot.hasAttribute('inert')).toBe(false)
    expect(mockPageRoot.classList.contains('page-under-drawer')).toBe(false)
    expect(mockHeader.hasAttribute('inert')).toBe(false)
  })

  it('safely handles missing document or non-standard mock environment without error', () => {
    ;(global as any).document = undefined
    expect(() => setBackgroundInert('test', true)).not.toThrow()
    expect(() => setBackgroundInert('test', false)).not.toThrow()

    // Environment with document but no getElementById (like dom-polyfill)
    ;(global as any).document = {}
    expect(() => setBackgroundInert('test2', true)).not.toThrow()
    expect(() => setBackgroundInert('test2', false)).not.toThrow()
  })
})
