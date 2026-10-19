import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { NextRequest, NextResponse } from 'next/server'

// Polyfill React globally for Vitest Node JSX runner
;(globalThis as any).React = React

// Mock next/navigation for App Router client hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/look/test-look-id',
  useSearchParams: () => new URLSearchParams(),
}))

// Admin modules & components
import { verifyAdminToken, withAdminAuth } from '@/lib/admin'
import { env } from '@/lib/env'
import { AppError, ErrorCodes } from '@/lib/errors'
import { createProduct, deleteProduct } from '@/components/admin/admin-api'
import { ProductCatalogTable } from '@/components/admin/ProductCatalogTable'
import { PhysicalScalePreview } from '@/components/admin/PhysicalScalePreview'
import { AdminAuthCard } from '@/components/admin/AdminAuthCard'
import { AdminHealthMonitor } from '@/components/admin/AdminHealthMonitor'
import { ProductCreateModal } from '@/components/admin/ProductCreateModal'
import AdminPage, { metadata as adminMetadata } from '@/app/admin/page'

import { ToastProvider } from '@/components/Toast'

// Look modules & components
import SharedLookPage, { generateMetadata as generateLookMetadata } from '@/app/look/[id]/page'
import { LookClient } from '@/app/look/[id]/LookClient'
import { Product } from '@/lib/products'

describe('Milestone 3 Adversarial Challenge: /admin and /look/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // DOMAIN 1: /admin Token Authentication & Security Guard
  // =========================================================================
  describe('Domain 1: Admin Token Authentication & Header Verification', () => {
    it('1.1 throws 503 ADMIN_DISABLED when env.ADMIN_TOKEN is undefined or empty', () => {
      const originalToken = env.ADMIN_TOKEN
      try {
        ;(env as any).ADMIN_TOKEN = undefined

        const request = new NextRequest('http://localhost/api/admin/products', {
          headers: { 'x-admin-token': 'any-token' },
        })

        expect(() => verifyAdminToken(request)).toThrow(AppError)
        try {
          verifyAdminToken(request)
        } catch (err: any) {
          expect(err.code).toBe(ErrorCodes.ADMIN_DISABLED)
          expect(err.httpStatus).toBe(503)
          expect(err.message).toBe('Admin functionality is disabled')
        }
      } finally {
        ;(env as any).ADMIN_TOKEN = originalToken
      }
    })

    it('1.2 throws 401 UNAUTHORIZED when x-admin-token header is missing', () => {
      const originalToken = env.ADMIN_TOKEN
      try {
        ;(env as any).ADMIN_TOKEN = 'darpan-atelier-secret-key-2026'

        const request = new NextRequest('http://localhost/api/admin/products')

        expect(() => verifyAdminToken(request)).toThrow(AppError)
        try {
          verifyAdminToken(request)
        } catch (err: any) {
          expect(err.code).toBe(ErrorCodes.UNAUTHORIZED)
          expect(err.httpStatus).toBe(401)
          expect(err.message).toBe('Invalid admin token')
        }
      } finally {
        ;(env as any).ADMIN_TOKEN = originalToken
      }
    })

    it('1.3 throws 401 UNAUTHORIZED when x-admin-token does not match configured secret', () => {
      const originalToken = env.ADMIN_TOKEN
      try {
        ;(env as any).ADMIN_TOKEN = 'darpan-atelier-secret-key-2026'

        const request = new NextRequest('http://localhost/api/admin/products', {
          headers: { 'x-admin-token': 'incorrect-token' },
        })

        expect(() => verifyAdminToken(request)).toThrow(AppError)
        try {
          verifyAdminToken(request)
        } catch (err: any) {
          expect(err.code).toBe(ErrorCodes.UNAUTHORIZED)
          expect(err.httpStatus).toBe(401)
        }
      } finally {
        ;(env as any).ADMIN_TOKEN = originalToken
      }
    })

    it('1.4 passes verification when x-admin-token strictly matches configured secret', () => {
      const originalToken = env.ADMIN_TOKEN
      try {
        ;(env as any).ADMIN_TOKEN = 'darpan-atelier-secret-key-2026'

        const request = new NextRequest('http://localhost/api/admin/products', {
          headers: { 'x-admin-token': 'darpan-atelier-secret-key-2026' },
        })

        expect(() => verifyAdminToken(request)).not.toThrow()
      } finally {
        ;(env as any).ADMIN_TOKEN = originalToken
      }
    })

    it('1.5 withAdminAuth wraps handler and returns JSON 401 on authentication failure', async () => {
      const originalToken = env.ADMIN_TOKEN
      try {
        ;(env as any).ADMIN_TOKEN = 'darpan-atelier-secret-key-2026'

        const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }))
        const request = new NextRequest('http://localhost/api/admin/products', {
          headers: { 'x-admin-token': 'bad-token' },
        })

        const response = await withAdminAuth(request, handler)
        expect(response.status).toBe(401)
        const json = await response.json()
        expect(json.code).toBe(ErrorCodes.UNAUTHORIZED)
        expect(json.message).toBe('Invalid admin token')
        expect(handler).not.toHaveBeenCalled()
      } finally {
        ;(env as any).ADMIN_TOKEN = originalToken
      }
    })

    it('1.6 withAdminAuth passes valid request to downstream handler and returns handler response', async () => {
      const originalToken = env.ADMIN_TOKEN
      try {
        ;(env as any).ADMIN_TOKEN = 'darpan-atelier-secret-key-2026'

        const handler = vi.fn().mockResolvedValue(NextResponse.json({ created: true }, { status: 201 }))
        const request = new NextRequest('http://localhost/api/admin/products', {
          headers: { 'x-admin-token': 'darpan-atelier-secret-key-2026' },
        })

        const response = await withAdminAuth(request, handler)
        expect(response.status).toBe(201)
        const json = await response.json()
        expect(json.created).toBe(true)
        expect(handler).toHaveBeenCalledTimes(1)
      } finally {
        ;(env as any).ADMIN_TOKEN = originalToken
      }
    })

    it('1.7 admin-api client trims whitespace from token before sending x-admin-token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'new-piece', success: true }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const formData = new FormData()
      await createProduct(formData, '   untrimmed-secret-token   ')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const callHeaders = mockFetch.mock.calls[0][1].headers
      expect(callHeaders['x-admin-token']).toBe('untrimmed-secret-token')

      await deleteProduct('test-id', '   untrimmed-secret-token   ')
      const deleteHeaders = mockFetch.mock.calls[1][1].headers
      expect(deleteHeaders['x-admin-token']).toBe('untrimmed-secret-token')
    })
  })

  // =========================================================================
  // DOMAIN 2: Seed Product Immutability & Protection
  // =========================================================================
  describe('Domain 2: Seed Product Immutability & Protected Catalog', () => {
    const seedIds = [
      'gilded-teardrop',
      'met-gold-earring',
      'met-gold-pendant',
      'orb-chain',
      'dot-stud',
      'emerald-blouse',
    ]

    const mockSeedProducts: Product[] = [
      {
        id: 'gilded-teardrop',
        name: 'Gilded Teardrop',
        brand: 'Kaari Studio',
        type: 'single',
        heightCm: 3.0,
        widthCm: 1.3,
        metal: 'gold',
        priceInr: 1899,
        imagePath: '/products/gilded-teardrop.png',
        source: 'seed',
        licence: 'seed',
        sizes: [2.0, 3.0, 4.5, 6.0],
      },
      {
        id: 'dot-stud',
        name: 'Dot Stud',
        brand: 'Kaari Studio',
        type: 'stud',
        heightCm: 0.6,
        widthCm: 0.6,
        metal: 'silver',
        priceInr: 899,
        imagePath: '/products/dot-stud.png',
        source: 'seed',
        licence: 'seed',
      },
    ]

    const mockRuntimeProduct: Product = {
      id: 'chandbali-runtime',
      name: 'Chandbali Pearl Drop',
      brand: 'Kaari Studio',
      type: 'single',
      heightCm: 4.5,
      widthCm: 2.5,
      metal: 'gold',
      priceInr: 2999,
      imagePath: '/products/chandbali-runtime.png',
      source: 'Runtime addition',
      licence: 'Runtime addition',
    }

    it('2.1 renders IMMUTABLE SEED badge and LOCKED button for all canonical seed products', () => {
      const html = renderToString(
        React.createElement(ProductCatalogTable, {
          products: mockSeedProducts,
          adminToken: 'test-token',
          loading: false,
          onProductDeleted: () => {},
          onOpenCreateModal: () => {},
        })
      )

      expect(html).toContain('🔒 IMMUTABLE SEED')
      expect(html).toContain('LOCKED')
      expect(html).toContain('title="Seed catalogue pieces cannot be deleted or modified"')
      expect(html).not.toContain('DELETING…')
    })

    it('2.2 renders RUNTIME PIECE badge and active DELETE button for non-seed runtime products', () => {
      const html = renderToString(
        React.createElement(ProductCatalogTable, {
          products: [mockRuntimeProduct],
          adminToken: 'test-token',
          loading: false,
          onProductDeleted: () => {},
          onOpenCreateModal: () => {},
        })
      )

      expect(html).toContain('● RUNTIME PIECE')
      expect(html).toContain('DELETE')
      expect(html).not.toContain('🔒 IMMUTABLE SEED')
      expect(html).not.toContain('LOCKED')
    })

    it('2.3 renders dimensions according to taxonomy (width × height for single, length for necklace, garmentCategory for garment)', () => {
      const mixedProducts: Product[] = [
        mockSeedProducts[0], // single: 1.3 × 3 cm
        {
          id: 'orb-chain',
          name: 'Orb Chain',
          brand: 'Kaari Studio',
          type: 'necklace',
          lengthCm: 42,
          priceInr: 3499,
          imagePath: '/products/orb-chain.png',
          source: 'seed',
          licence: 'seed',
        },
        {
          id: 'emerald-blouse',
          name: 'Emerald Silk Blouse',
          brand: 'Kaari Studio',
          type: 'garment',
          garmentCategory: 'upper_body',
          priceInr: 4999,
          imagePath: '/products/emerald-blouse.png',
          source: 'seed',
          licence: 'seed',
        },
      ]

      const html = renderToString(
        React.createElement(ProductCatalogTable, {
          products: mixedProducts,
          adminToken: 'test-token',
          loading: false,
          onProductDeleted: () => {},
          onOpenCreateModal: () => {},
        })
      )

      expect(html).toContain('1.3')
      expect(html).toContain('3 cm')
      expect(html).toContain('42 cm length')
      expect(html).toContain('upper_body')
    })

    it('2.4 verifies all 6 canonical seed product IDs are covered in immutability rules', () => {
      seedIds.forEach((id) => {
        const prod: Product = {
          id,
          name: `Test ${id}`,
          brand: 'Kaari Studio',
          type: 'single',
          heightCm: 3.0,
          widthCm: 1.5,
          metal: 'gold',
          priceInr: 1000,
          imagePath: `/products/${id}.png`,
          source: 'seed',
          licence: 'seed',
        }
        const html = renderToString(
          React.createElement(ProductCatalogTable, {
            products: [prod],
            adminToken: 'test-token',
            loading: false,
            onProductDeleted: () => {},
            onOpenCreateModal: () => {},
          })
        )
        expect(html).toContain('🔒 IMMUTABLE SEED')
        expect(html).toContain('LOCKED')
      })
    })
  })

  // =========================================================================
  // DOMAIN 3: Physical Scale Preview Calibration Mathematics
  // =========================================================================
  describe('Domain 3: Physical Scale Preview Calibration Mathematics', () => {
    const PX_PER_CM = 35

    it('3.1 calculates exact render dimensions at 35 px/cm baseline', () => {
      const testCases = [
        { heightCm: 2.0, widthCm: 1.0, expectedH: 70, expectedW: 35 },
        { heightCm: 3.0, widthCm: 1.5, expectedH: 105, expectedW: 53 },
        { heightCm: 4.5, widthCm: 2.0, expectedH: 158, expectedW: 70 },
        { heightCm: 6.0, widthCm: 3.0, expectedH: 210, expectedW: 105 },
        { heightCm: 0.6, widthCm: 0.6, expectedH: 21, expectedW: 21 },
      ]

      testCases.forEach(({ heightCm, widthCm, expectedH, expectedW }) => {
        const calcH = Math.max(10, Math.round(heightCm * PX_PER_CM))
        const calcW = Math.max(10, Math.round(widthCm * PX_PER_CM))
        expect(calcH).toBe(expectedH)
        expect(calcW).toBe(expectedW)

        const html = renderToString(
          React.createElement(PhysicalScalePreview, {
            heightCm,
            widthCm,
            productName: 'Teardrop Earring',
          })
        )
        expect(html).toContain(`height:${expectedH}px`)
        expect(html).toContain(`width:${expectedW}px`)
        // Match height label in caliper or text
        expect(html).toMatch(new RegExp(`${heightCm}(<!-- -->)? cm`))
      })
    })

    it('3.2 renders prompt fallback when dimensions are zero or negative', () => {
      const invalidCases = [
        { heightCm: 0, widthCm: 0 },
        { heightCm: -2.0, widthCm: 1.0 },
        { heightCm: 3.0, widthCm: -1.0 },
        { heightCm: -5.0, widthCm: -5.0 },
      ]

      invalidCases.forEach(({ heightCm, widthCm }) => {
        const html = renderToString(
          React.createElement(PhysicalScalePreview, {
            heightCm,
            widthCm,
          })
        )
        expect(html).toContain('Enter height and width to view true-scale preview')
        expect(html).not.toContain('height:-')
      })
    })

    it('3.3 clamps minimum rendered dimension to 10px to prevent invisible artifacts', () => {
      const tinyHeight = 0.05 // 0.05 * 35 = 1.75px -> clamped to 10px
      const calcH = Math.max(10, Math.round(tinyHeight * PX_PER_CM))
      expect(calcH).toBe(10)

      const html = renderToString(
        React.createElement(PhysicalScalePreview, {
          heightCm: tinyHeight,
          widthCm: tinyHeight,
        })
      )
      expect(html).toContain('height:10px')
      expect(html).toContain('width:10px')
    })

    it('3.4 renders Indian 1-Rupee coin reference with 2.2 cm diameter (~77px)', () => {
      const coinDiameterCm = 2.2
      const coinPx = Math.round(coinDiameterCm * PX_PER_CM)
      expect(coinPx).toBe(77)

      const html = renderToString(
        React.createElement(PhysicalScalePreview, {
          heightCm: 3.0,
          widthCm: 1.5,
        })
      )
      expect(html).toContain('₹1 Coin')
      expect(html).toContain('2.2 cm ⌀')
      expect(html).toContain(`width:${coinPx}px`)
      expect(html).toContain(`height:${coinPx}px`)
    })

    it('3.5 documents technical baseline constant and resolution metadata', () => {
      const html = renderToString(
        React.createElement(PhysicalScalePreview, {
          heightCm: 3.0,
          widthCm: 1.5,
        })
      )
      expect(html).toContain('Iris Baseline: 11.7 mm reference')
      expect(html).toContain('Resolution: ~35 px/cm calibrated')
    })
  })

  // =========================================================================
  // DOMAIN 4: /look/[id] Route, Metadata & Not-Found Fallbacks
  // =========================================================================
  describe('Domain 4: /look/[id] Route, Metadata & Hydration Fallbacks', () => {
    it('4.1 generateMetadata returns formatted title and editorial description with 11.7 mm reference', async () => {
      const params = Promise.resolve({ id: 'bridal-gold-look-99' })
      const meta = await generateLookMetadata({ params })

      expect(meta.title).toBe('Curated Look #bridal-gold-look-99 — Darpan')
      expect(meta.description).toContain('11.7 mm iris baseline')
    })

    it('4.2 SharedLookPage server component renders breadcrumb navigation and passes ID to client', async () => {
      const params = Promise.resolve({ id: 'royal-navy-2026' })
      const pageComponent = await SharedLookPage({ params })
      const html = renderToString(
        React.createElement(ToastProvider, null, pageComponent)
      )

      expect(html).toContain('HOME')
      expect(html).toContain('LOOKS')
      expect(html).toContain('royal-navy-2026')
      expect(html).toContain('HYDRATING PRESETS')
    })

    it('4.3 LookClient displays hydration placeholder during initial fetch', () => {
      const html = renderToString(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(LookClient, { lookId: 'non-existent-look-id' })
        )
      )
      expect(html).toContain('Loading curated styling configuration…')
      expect(html).toContain('HYDRATING PRESETS')
    })
  })

  // =========================================================================
  // DOMAIN 5: Editorial Page Shells & Accessibility
  // =========================================================================
  describe('Domain 5: Editorial Page Shells & Accessibility Signatures', () => {
    it('5.1 /admin page sets standard metadata, luxury breadcrumbs and clean SSR placeholder', () => {
      expect(adminMetadata.title).toContain('Atelier Admin')
      expect(adminMetadata.description).toContain('Store administration')

      const pageHtml = renderToString(React.createElement(AdminPage))
      expect(pageHtml).toContain('STUDIO ADMINISTRATION')
      expect(pageHtml).toContain('Atelier')
      expect(pageHtml).toContain('Admin')
      expect(pageHtml).toContain('HOME')
      expect(pageHtml).toContain('ADMIN')
      expect(pageHtml).toContain('INITIALIZING ATELIER CONTROLS…')
    })

    it('5.2 AdminAuthCard renders semantic form with required password input and focus rings', () => {
      const html = renderToString(
        React.createElement(AdminAuthCard, { onAuthenticate: async () => true })
      )
      expect(html).toContain('Studio Admin Token')
      expect(html).toContain('id="admin-token-input"')
      expect(html).toContain('type="password"')
      expect(html).toContain('UNLOCK ATELIER CONTROLS')
      expect(html).toContain('focus-visible:outline-[var(--gold)]')
    })
  })

  // =========================================================================
  // DOMAIN 6: Admin Health Telemetry & Unit Balance Guard
  // =========================================================================
  describe('Domain 6: Admin Health Telemetry & Unit Balance Guard', () => {
    it('6.1 displays OPERATIONAL badge when upstream key is valid and units exceed floor', () => {
      const html = renderToString(
        React.createElement(AdminHealthMonitor, {
          health: {
            ok: true,
            units: 520,
            reserveFloor: 450,
            keyValid: true,
          },
          loading: false,
          onRefresh: () => {},
        })
      )

      expect(html).toContain('OPERATIONAL')
      expect(html).toContain('70') // spendable: 520 - 450
      expect(html).toContain('450') // reserve floor
      expect(html).toContain('520') // gross balance
      expect(html).toContain('Active &amp; Valid')
    })

    it('6.2 displays RESERVE PROTECTED badge when units fall below reserve floor', () => {
      const html = renderToString(
        React.createElement(AdminHealthMonitor, {
          health: {
            ok: true,
            units: 420,
            reserveFloor: 450,
            keyValid: true,
          },
          loading: false,
          onRefresh: () => {},
        })
      )

      expect(html).toContain('RESERVE PROTECTED')
      expect(html).toContain('0') // spendable clamped to 0
      expect(html).toContain('450') // reserve floor
      expect(html).toContain('420') // gross balance
    })

    it('6.3 displays OFFLINE / INVALID KEY badge when health check fails or key is invalid', () => {
      const html = renderToString(
        React.createElement(AdminHealthMonitor, {
          health: {
            ok: false,
            keyValid: false,
            message: 'Invalid API credentials',
          },
          loading: false,
          onRefresh: () => {},
        })
      )

      expect(html).toContain('OFFLINE / INVALID KEY')
      expect(html).toContain('Check API Credentials')
    })

    it('6.4 renders refreshing indicator when loading prop is true', () => {
      const html = renderToString(
        React.createElement(AdminHealthMonitor, {
          health: null,
          loading: true,
          onRefresh: () => {},
        })
      )

      expect(html).toContain('REFRESHING…')
    })
  })

  // =========================================================================
  // DOMAIN 7: Product Creation Modal Architecture & Accessibility
  // =========================================================================
  describe('Domain 7: Product Creation Modal Architecture & Constraints', () => {
    it('7.1 renders null when isOpen is false', () => {
      const html = renderToString(
        React.createElement(ProductCreateModal, {
          isOpen: false,
          onClose: () => {},
          onSuccess: () => {},
          adminToken: 'test-token',
        })
      )

      expect(html).toBe('')
    })

    it('7.2 renders accessible modal dialog with proper ARIA attributes when isOpen is true', () => {
      const html = renderToString(
        React.createElement(ProductCreateModal, {
          isOpen: true,
          onClose: () => {},
          onSuccess: () => {},
          adminToken: 'test-token',
        })
      )

      expect(html).toContain('role="dialog"')
      expect(html).toContain('aria-modal="true"')
      expect(html).toContain('aria-labelledby="create-product-title"')
      expect(html).toContain('Create New')
      expect(html).toContain('Product')
      expect(html).toContain('SAVE TO ATELIER CATALOGUE')
      expect(html).toContain('Physical Height (cm)')
      expect(html).toContain('Physical Width (cm)')
    })
  })
})

