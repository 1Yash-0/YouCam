'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PillButton } from '@/components/PillButton'
import { PhysicalScalePreview } from './PhysicalScalePreview'
import { ProductFormData } from './types'
import { createProduct } from './admin-api'

interface ProductCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  adminToken: string
}

const initialForm: ProductFormData = {
  id: '',
  name: '',
  brand: 'Kaari Studio',
  type: 'single',
  priceInr: '',
  heightCm: '3.0',
  widthCm: '1.5',
  lengthCm: '40.0',
  metal: 'gold',
  garmentCategory: 'upper_body',
  sizes: '2.0, 3.0, 4.5, 6.0',
  anchorPoint: '375, 660',
  imageFile: null,
}

export function ProductCreateModal({
  isOpen,
  onClose,
  onSuccess,
  adminToken,
}: ProductCreateModalProps) {
  const [form, setForm] = useState<ProductFormData>(initialForm)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Clean up object URL when image changes
  useEffect(() => {
    if (!form.imageFile) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(form.imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [form.imageFile])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleFieldChange = (field: keyof ProductFormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!form.imageFile) {
      setErrorMessage('Please select a cutout image for the product.')
      return
    }

    const price = Number(form.priceInr)
    if (isNaN(price) || price <= 0) {
      setErrorMessage('Please enter a valid positive price in INR.')
      return
    }

    const formData = new FormData()
    formData.append('id', form.id.trim())
    formData.append('name', form.name.trim())
    formData.append('brand', form.brand.trim())
    formData.append('type', form.type)
    formData.append('priceInr', form.priceInr)
    formData.append('image', form.imageFile)

    if (form.type === 'single' || form.type === 'stud') {
      const h = Number(form.heightCm)
      const w = Number(form.widthCm)
      if (isNaN(h) || h <= 0 || isNaN(w) || w <= 0) {
        setErrorMessage('Physical height and width in cm must be positive numbers.')
        return
      }
      formData.append('heightCm', form.heightCm)
      formData.append('widthCm', form.widthCm)
      if (form.metal) formData.append('metal', form.metal)

      // Parse sizes string into JSON array if provided
      if (form.sizes.trim()) {
        try {
          const parsedSizes = form.sizes
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => !isNaN(n) && n > 0)
          if (parsedSizes.length > 0) {
            formData.append('sizes', JSON.stringify(parsedSizes))
          }
        } catch {
          // ignore parsing error, pass raw
        }
      }

      // Parse anchorPoint
      if (form.anchorPoint.trim()) {
        try {
          const parts = form.anchorPoint.split(',').map((p) => Number(p.trim()))
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            formData.append('anchorPoint', JSON.stringify([parts[0], parts[1]]))
          }
        } catch {
          // ignore
        }
      }
    } else if (form.type === 'necklace') {
      const len = Number(form.lengthCm)
      if (isNaN(len) || len <= 0) {
        setErrorMessage('Necklace length in cm must be a positive number.')
        return
      }
      formData.append('lengthCm', form.lengthCm)
    } else if (form.type === 'garment') {
      formData.append('garmentCategory', form.garmentCategory)
    }

    setSubmitting(true)
    const result = await createProduct(formData, adminToken)
    setSubmitting(false)

    if (!result.ok) {
      setErrorMessage(result.error || 'Failed to create product.')
      return
    }

    // Success
    setForm(initialForm)
    onSuccess()
    onClose()
  }

  const heightVal = Number(form.heightCm) || 0
  const widthVal = Number(form.widthCm) || 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-product-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] rounded-[var(--radius-sm)] shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4 mb-6">
          <div>
            <span className="ui-label text-[10px] text-[var(--gold)] block">CATALOGUE EXTENSION</span>
            <h2 id="create-product-title" className="text-2xl font-light tracking-tight">
              Create New <span className="font-serif-italic">Product</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-label text-xs text-[var(--ink-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] p-2"
            aria-label="Close modal"
          >
            ✕ CLOSE
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs rounded-[var(--radius-sm)]"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left Column: Form Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prod-id" className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
                    Product ID (Slug) *
                  </label>
                  <input
                    id="prod-id"
                    type="text"
                    required
                    value={form.id}
                    onChange={(e) => handleFieldChange('id', e.target.value)}
                    placeholder="chandbali-pearl"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                  />
                </div>
                <div>
                  <label htmlFor="prod-name" className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
                    Product Title *
                  </label>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="Chandbali Pearl Drop"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="prod-type" className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
                    Taxonomy Type *
                  </label>
                  <select
                    id="prod-type"
                    value={form.type}
                    onChange={(e) => handleFieldChange('type', e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                  >
                    <option value="single">Single Earring</option>
                    <option value="stud">Stud Earring</option>
                    <option value="necklace">Necklace</option>
                    <option value="garment">Garment</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="prod-brand" className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
                    Brand *
                  </label>
                  <input
                    id="prod-brand"
                    type="text"
                    required
                    value={form.brand}
                    onChange={(e) => handleFieldChange('brand', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                  />
                </div>
                <div>
                  <label htmlFor="prod-price" className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
                    Price (INR ₹) *
                  </label>
                  <input
                    id="prod-price"
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={form.priceInr}
                    onChange={(e) => handleFieldChange('priceInr', e.target.value)}
                    placeholder="2499"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                  />
                </div>
              </div>

              {/* Type-Specific Dimensions */}
              {(form.type === 'single' || form.type === 'stud') && (
                <div className="p-4 rounded-[var(--radius-sm)] border border-[var(--gold)]/30 bg-[var(--gold)]/5 space-y-3">
                  <span className="ui-label text-[10px] text-[var(--gold)] block">
                    Calibrated Earring Dimensions
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="prod-height" className="ui-label text-[9px] text-[var(--ink-2)] block mb-1">
                        Physical Height (cm) *
                      </label>
                      <input
                        id="prod-height"
                        type="number"
                        step="0.1"
                        min="0.1"
                        required
                        value={form.heightCm}
                        onChange={(e) => handleFieldChange('heightCm', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="prod-width" className="ui-label text-[9px] text-[var(--ink-2)] block mb-1">
                        Physical Width (cm) *
                      </label>
                      <input
                        id="prod-width"
                        type="number"
                        step="0.1"
                        min="0.1"
                        required
                        value={form.widthCm}
                        onChange={(e) => handleFieldChange('widthCm', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="prod-metal" className="ui-label text-[9px] text-[var(--ink-2)] block mb-1">
                        Precious Metal Tone
                      </label>
                      <select
                        id="prod-metal"
                        value={form.metal}
                        onChange={(e) => handleFieldChange('metal', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                      >
                        <option value="gold">Yellow Gold</option>
                        <option value="silver">Sterling Silver</option>
                        <option value="rose-gold">Rose Gold</option>
                        <option value="platinum">Platinum</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="prod-sizes" className="ui-label text-[9px] text-[var(--ink-2)] block mb-1">
                        Chip Sizing Options (cm)
                      </label>
                      <input
                        id="prod-sizes"
                        type="text"
                        value={form.sizes}
                        onChange={(e) => handleFieldChange('sizes', e.target.value)}
                        placeholder="2.0, 3.0, 4.5, 6.0"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {form.type === 'necklace' && (
                <div className="p-4 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white/40 dark:bg-black/20">
                  <label htmlFor="prod-length" className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
                    Necklace Chain Length (cm) *
                  </label>
                  <input
                    id="prod-length"
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={form.lengthCm}
                    onChange={(e) => handleFieldChange('lengthCm', e.target.value)}
                    placeholder="40.0"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                  />
                </div>
              )}

              {form.type === 'garment' && (
                <div className="p-4 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white/40 dark:bg-black/20">
                  <label htmlFor="prod-garment-cat" className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
                    Garment Category *
                  </label>
                  <select
                    id="prod-garment-cat"
                    value={form.garmentCategory}
                    onChange={(e) => handleFieldChange('garmentCategory', e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                  >
                    <option value="upper_body">Upper Body (Blouse / Top)</option>
                    <option value="lower_body">Lower Body (Skirt / Lehenga)</option>
                    <option value="full_body">Full Body (Saree / Anarkali)</option>
                    <option value="outer">Outer (Shawl / Dupatta)</option>
                  </select>
                </div>
              )}

              {/* Image File Dropzone */}
              <div>
                <label htmlFor="prod-image" className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
                  Cutout Image (PNG / JPG) *
                </label>
                <input
                  id="prod-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    handleFieldChange('imageFile', file)
                  }}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-[var(--gold)] file:text-white file:cursor-pointer cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                />
                <p className="text-[10px] text-[var(--ink-2)] mt-1">
                  Transparent background recommended. Automatically resized if &gt;1500px.
                </p>
              </div>
            </div>

            {/* Right Column: Live Physical Scale Preview */}
            <div className="flex flex-col justify-start">
              <PhysicalScalePreview
                heightCm={heightVal}
                widthCm={widthVal}
                imagePreviewUrl={imagePreview}
                productName={form.name || form.id || 'New Piece'}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 border-t border-[var(--line)] pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="ui-label text-xs text-[var(--ink-2)] hover:text-[var(--ink)] px-4 py-2"
            >
              CANCEL
            </button>
            <PillButton
              type="submit"
              variant="primary"
              disabled={submitting}
              className="cursor-pointer"
            >
              {submitting ? 'PROCESSING & SCALING…' : 'SAVE TO ATELIER CATALOGUE'}
            </PillButton>
          </div>
        </form>
      </div>
    </div>
  )
}
