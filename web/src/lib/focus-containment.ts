/**
 * Multi-drawer reference-counted background focus containment controller.
 * Sets `inert` attribute on #page-root (or <main>) and <header> when any modal drawer is open.
 * Also maintains visual tactile scaling class `.page-under-drawer` on #page-root.
 */

const activeDrawerIds = new Set<string>()

/**
 * Toggles inert state and background visual depth (.page-under-drawer)
 * on background containers (#page-root, <main>, <header>) using a reference
 * count so that nested or stacked drawers do not remove inert prematurely.
 */
export function setBackgroundInert(drawerId: string, shouldBeInert: boolean): void {
  if (typeof document === 'undefined') return

  if (shouldBeInert) {
    activeDrawerIds.add(drawerId)
  } else {
    activeDrawerIds.delete(drawerId)
  }

  const isAnyDrawerOpen = activeDrawerIds.size > 0

  // 1. Target #page-root or <main>
  const pageRoot = typeof document !== 'undefined'
    ? (document.getElementById?.('page-root') || document.querySelector?.('main') || null)
    : null

  if (pageRoot) {
    if (isAnyDrawerOpen) {
      if (typeof pageRoot.setAttribute === 'function') {
        pageRoot.setAttribute('inert', '')
      }
      if (pageRoot.classList && typeof pageRoot.classList.add === 'function') {
        pageRoot.classList.add('page-under-drawer')
      }
    } else {
      if (typeof pageRoot.removeAttribute === 'function') {
        pageRoot.removeAttribute('inert')
      }
      if (pageRoot.classList && typeof pageRoot.classList.remove === 'function') {
        pageRoot.classList.remove('page-under-drawer')
      }
    }
  }

  // 2. Target <header> navigation bar
  const header = typeof document !== 'undefined'
    ? (document.querySelector?.('header') || null)
    : null

  if (header) {
    if (isAnyDrawerOpen) {
      if (typeof header.setAttribute === 'function') {
        header.setAttribute('inert', '')
      }
    } else {
      if (typeof header.removeAttribute === 'function') {
        header.removeAttribute('inert')
      }
    }
  }
}

/**
 * Returns the number of currently active drawers holding inert state.
 */
export function getActiveDrawerCount(): number {
  return activeDrawerIds.size
}

/**
 * Clears active drawer tracking and removes inert attributes (useful for test resets).
 */
export function resetDrawerInert(): void {
  activeDrawerIds.clear()
  if (typeof document === 'undefined') return
  const pageRoot = document.getElementById?.('page-root') || document.querySelector?.('main') || null
  if (pageRoot) {
    pageRoot.removeAttribute?.('inert')
    pageRoot.classList?.remove('page-under-drawer')
  }
  const header = document.querySelector?.('header') || null
  if (header) {
    header.removeAttribute?.('inert')
  }
}
