'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Product } from '@/lib/products'
import { PillButton } from '@/components/PillButton'
import { deleteProduct } from './admin-api'

const SEED_PRODUCT_IDS = new Set([
  'gilded-teardrop',
  'met-gold-earring',
  'met-gold-pendant',
  'orb-chain',
  'dot-stud',
  'emerald-blouse',
])

interface ProductCatalogTableProps {
  products: Product[]
  adminToken: string
  loading: boolean
  onProductDeleted: () => void
  onOpenCreateModal: () => void
}

export function ProductCatalogTable({
  products,
  adminToken,
  loading,
  onProductDeleted,
  onOpenCreateModal,
}: ProductCatalogTableProps) {
  const [filterType, setFilterType] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)

  const isSeed = (id: string) => SEED_PRODUCT_IDS.has(id.toLowerCase())

  const filteredProducts = products.filter((p) => {
    if (filterType === 'all') return true
    return p.type === filterType
  })

  const handleDelete = async (product: Product) => {
    if (isSeed(product.id)) {
      setErrorToast('Cannot modify or delete seed products. Seed catalog is protected.')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete runtime product "${product.name}" (${product.id})?`
    )
    if (!confirmed) return

    setDeletingId(product.id)
    setErrorToast(null)

    const res = await deleteProduct(product.id, adminToken)
    setDeletingId(null)

    if (!res.ok) {
      setErrorToast(res.error || 'Failed to delete runtime product.')
    } else {
      onProductDeleted()
    }
  }

  return (
    <div className="bg-[var(--paper)] border border-[var(--line)] rounded-[var(--radius-sm)] p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5 mb-5">
        <div>
          <span className="ui-label text-[10px] text-[var(--gold)] block">INVENTORY CONTROLS</span>
          <h2 className="text-xl font-medium text-[var(--ink)]">Atelier Catalogue</h2>
        </div>

        <div className="flex items-center gap-3">
          <PillButton
            onClick={onOpenCreateModal}
            variant="primary"
            className="cursor-pointer"
          >
            + CREATE PRODUCT
          </PillButton>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'ALL PIECES', value: 'all' },
          { label: 'SINGLE EARRINGS', value: 'single' },
          { label: 'STUDS', value: 'stud' },
          { label: 'NECKLACES', value: 'necklace' },
          { label: 'GARMENTS', value: 'garment' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilterType(tab.value)}
            className={`px-3 py-1.5 rounded-full ui-label text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${
              filterType === tab.value
                ? 'bg-[var(--ink)] text-white'
                : 'bg-black/5 dark:bg-white/5 text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorToast && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs rounded-[var(--radius-sm)] flex items-center justify-between"
        >
          <span>{errorToast}</span>
          <button
            type="button"
            onClick={() => setErrorToast(null)}
            className="text-xs font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Product List Table */}
      {loading ? (
        <div className="py-12 text-center text-[var(--ink-2)] ui-label text-xs">
          LOADING CATALOGUE DATA…
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-12 text-center text-[var(--ink-2)] text-xs">
          No products found in this category.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--ink)]">
            <thead className="border-b border-[var(--line)] text-[10px] ui-label text-[var(--ink-2)] uppercase">
              <tr>
                <th className="py-3 px-3">Item</th>
                <th className="py-3 px-3">Taxonomy</th>
                <th className="py-3 px-3">Dimensions</th>
                <th className="py-3 px-3">Price</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filteredProducts.map((prod) => {
                const seed = isSeed(prod.id)
                let dimString = '—'
                if ('heightCm' in prod && 'widthCm' in prod) {
                  dimString = `${prod.widthCm} × ${prod.heightCm} cm`
                } else if ('lengthCm' in prod) {
                  dimString = `${prod.lengthCm} cm length`
                } else if ('garmentCategory' in prod) {
                  dimString = prod.garmentCategory
                }

                return (
                  <tr key={prod.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded border border-[var(--line)] bg-white/40 dark:bg-black/20 overflow-hidden shrink-0">
                          <Image
                            src={prod.imagePath}
                            alt={prod.name}
                            fill
                            unoptimized
                            className="object-contain p-1"
                          />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-[var(--ink)]">{prod.name}</div>
                          <div className="text-[10px] font-mono text-[var(--ink-2)]">{prod.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 capitalize ui-label text-[10px] text-[var(--ink-2)]">
                      {prod.type}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs tabular-nums text-[var(--ink-2)]">
                      {dimString}
                    </td>
                    <td className="py-3 px-3 font-medium text-xs tabular-nums">
                      ₹{prod.priceInr.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      {seed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] ui-label bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                          🔒 IMMUTABLE SEED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] ui-label bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          ● RUNTIME PIECE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {seed ? (
                        <button
                          type="button"
                          disabled
                          title="Seed catalogue pieces cannot be deleted or modified"
                          className="text-[10px] ui-label text-[var(--ink-2)] opacity-40 cursor-not-allowed px-2 py-1"
                        >
                          LOCKED
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDelete(prod)}
                          disabled={deletingId === prod.id}
                          className="text-[10px] ui-label text-rose-600 hover:text-rose-700 hover:underline px-2 py-1 focus-visible:outline-2 focus-visible:outline-[var(--gold)] cursor-pointer"
                        >
                          {deletingId === prod.id ? 'DELETING…' : 'DELETE'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
