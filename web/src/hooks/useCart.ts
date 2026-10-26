'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

export const CART_STORAGE_KEY = 'darpan_saved_choices_v1'
const LEGACY_CART_STORAGE_KEY = 'darpan_bag_v1'
export const CART_EVENT_UPDATED = 'darpan:cart_updated'
export const CART_EVENT_OPEN = 'darpan:open_cart'
export const CART_EVENT_CLOSE = 'darpan:close_cart'

export interface CartItem {
  id: string
  productId: string
  title: string
  brand: string
  /** Legacy size field for existing product page callers. Prefer sizeLabel and selectionKey. */
  sizeCm?: number
  selectionKey?: string
  priceUsd: number
  productImageUrl: string
  sizeLabel?: string
}

export type CartItemInput = Omit<CartItem, 'id'> & {
  id?: string
}

function getStoredCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return []
  } catch (err) {
    console.error('Failed to parse cart from localStorage:', err)
    return []
  }
}

function persistCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(CART_EVENT_UPDATED, { detail: items }))
  } catch (err) {
    console.error('Failed to save cart to localStorage:', err)
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load initial cart and listen for updates
  useEffect(() => {
    // The previous bag stored full try-on image URLs. Remove that legacy cache.
    window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY)
    setItems(getStoredCart())
    setIsHydrated(true)

    const handleCartUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<CartItem[]>
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setItems(customEvent.detail)
      } else {
        setItems(getStoredCart())
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) {
        setItems(getStoredCart())
      }
    }

    const handleOpen = () => setIsCartOpen(true)
    const handleClose = () => setIsCartOpen(false)

    window.addEventListener(CART_EVENT_UPDATED, handleCartUpdated)
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener(CART_EVENT_OPEN, handleOpen)
    window.addEventListener(CART_EVENT_CLOSE, handleClose)

    return () => {
      window.removeEventListener(CART_EVENT_UPDATED, handleCartUpdated)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener(CART_EVENT_OPEN, handleOpen)
      window.removeEventListener(CART_EVENT_CLOSE, handleClose)
    }
  }, [])

  const addItem = useCallback((input: CartItemInput) => {
    setItems((prev) => {
      const identity = input.selectionKey ?? String(input.sizeCm ?? 'default')
      const generatedId = input.id || `${input.productId}-${identity}`
      const existingIndex = prev.findIndex(
        (item) => item.productId === input.productId && (item.selectionKey ?? String(item.sizeCm ?? 'default')) === identity
      )

      let next: CartItem[]
      if (existingIndex >= 0) {
        next = prev.map((item, idx) => {
          if (idx === existingIndex) {
            return {
              ...item,
              sizeLabel: input.sizeLabel ?? item.sizeLabel,
            }
          }
          return item
        })
      } else {
        const newItem: CartItem = {
          ...input,
          id: generatedId,
        }
        next = [...prev, newItem]
      }

      persistCart(next)
      return next
    })
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== itemId)
      persistCart(next)
      return next
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    persistCart([])
  }, [])

  const openCart = useCallback(() => {
    setIsCartOpen(true)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CART_EVENT_OPEN))
    }
  }, [])

  const closeCart = useCallback(() => {
    setIsCartOpen(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CART_EVENT_CLOSE))
    }
  }, [])

  const toggleCart = useCallback(() => {
    setIsCartOpen((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(next ? CART_EVENT_OPEN : CART_EVENT_CLOSE))
      }
      return next
    })
  }, [])

  const totalCount = useMemo(() => items.length, [items])

  return {
    items,
    totalCount,
    isCartOpen,
    isHydrated,
    addItem,
    removeItem,
    clearCart,
    openCart,
    closeCart,
    toggleCart,
  }
}
