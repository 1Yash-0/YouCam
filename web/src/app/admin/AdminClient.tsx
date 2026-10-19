'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Product } from '@/lib/products'
import { HealthData } from '@/components/admin/types'
import { fetchHealth, fetchAllProducts } from '@/components/admin/admin-api'
import { AdminAuthCard } from '@/components/admin/AdminAuthCard'
import { AdminHealthMonitor } from '@/components/admin/AdminHealthMonitor'
import { ProductCatalogTable } from '@/components/admin/ProductCatalogTable'
import { ProductCreateModal } from '@/components/admin/ProductCreateModal'

const STORAGE_KEY = 'darpan_admin_token'

export function AdminClient() {
  const [token, setToken] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [health, setHealth] = useState<HealthData | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Initialize token from sessionStorage on mount
  useEffect(() => {
    try {
      const savedToken = sessionStorage.getItem(STORAGE_KEY)
      if (savedToken && savedToken.trim()) {
        setToken(savedToken.trim())
      }
    } catch {
      // sessionStorage unavailable
    }
    setIsInitialized(true)
  }, [])

  const loadHealthData = useCallback(async () => {
    setHealthLoading(true)
    try {
      const data = await fetchHealth()
      setHealth(data)
    } catch (err) {
      console.error('Failed to load health data:', err)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  const loadProductsData = useCallback(async () => {
    setProductsLoading(true)
    try {
      const items = await fetchAllProducts()
      setProducts(items)
    } catch (err) {
      console.error('Failed to load products:', err)
    } finally {
      setProductsLoading(false)
    }
  }, [])

  // When token is set or refreshed, load data
  useEffect(() => {
    if (token) {
      loadHealthData()
      loadProductsData()
    }
  }, [token, loadHealthData, loadProductsData])

  const handleAuthenticate = async (enteredToken: string): Promise<boolean> => {
    const cleanToken = enteredToken.trim()
    if (!cleanToken) return false

    // Save token in state and session storage
    setToken(cleanToken)
    try {
      sessionStorage.setItem(STORAGE_KEY, cleanToken)
    } catch {
      // ignore
    }
    return true
  }

  const handleLogout = () => {
    setToken(null)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  if (!isInitialized) {
    return (
      <div className="py-24 text-center text-xs ui-label text-[var(--ink-2)]">
        INITIALIZING ATELIER CONTROLS…
      </div>
    )
  }

  if (!token) {
    return <AdminAuthCard onAuthenticate={handleAuthenticate} />
  }

  return (
    <div className="space-y-8">
      {/* Session Header / Atelier Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--paper)] border border-[var(--line)] rounded-[var(--radius-sm)] px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="ui-label text-xs text-[var(--ink)] font-medium">
            ATELIER SESSION ACTIVE
          </span>
          <span className="text-[11px] text-[var(--ink-2)] font-mono ml-2">
            ({token.slice(0, 4)}••••{token.slice(-4)})
          </span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="ui-label text-[11px] text-[var(--ink-2)] hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-[var(--gold)] transition-colors cursor-pointer"
        >
          LOCK ATELIER / LOG OUT
        </button>
      </div>

      {/* Health & Credits Monitor */}
      <AdminHealthMonitor
        health={health}
        loading={healthLoading}
        onRefresh={loadHealthData}
      />

      {/* Product Inventory Management */}
      <ProductCatalogTable
        products={products}
        adminToken={token}
        loading={productsLoading}
        onProductDeleted={loadProductsData}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
      />

      {/* Create Product Modal with Physical Scale Preview */}
      <ProductCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadProductsData}
        adminToken={token}
      />
    </div>
  )
}
