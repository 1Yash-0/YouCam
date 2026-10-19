import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { AboutClient } from '@/app/about/AboutClient'
import AboutPage, { metadata } from '@/app/about/page'
import { pxPerCm } from '@/lib/size'

describe('/about Route & Editorial Specifications', () => {
  const html = renderToString(React.createElement(AboutClient))

  describe('Section 1: Hero & Editorial Manifesto', () => {
    it('1.1 renders About Darpan title and editorial introduction', () => {
      expect(html).toContain('About')
      expect(html).toContain('Darpan')
      expect(html).toContain('Darpan means mirror.')
      expect(html).toContain('knowing how large a piece will look on your face before you buy')
    })

    it('1.2 renders four key value badges with Glint', () => {
      expect(html).toContain('11.7 MM ANATOMICAL CONSTANT')
      expect(html).toContain('±10% TOLERANCE GUARANTEED')
      expect(html).toContain('ZERO PHOTO RETENTION')
      expect(html).toContain('0-UNIT SAMPLE CACHE')
    })

    it('1.3 renders standard breadcrumb back to HOME', () => {
      expect(html).toContain('HOME')
      expect(html).toContain('ABOUT')
      expect(html).toContain('aria-label="Breadcrumb"')
    })
  })

  describe('Section 2: Iris Calibration & Optical Mathematics', () => {
    it('2.1 explains 11.7 mm iris diameter anatomical population constant', () => {
      expect(html).toContain('Human visible iris diameter has a remarkably constant average across populations: 11.7 mm')
      expect(html).toContain('11.7 mm')
    })

    it('2.2 documents ±10% physical scale measurement accuracy', () => {
      expect(html).toContain('Measurement verification confirming accuracy within ±10%')
      expect(html).toContain('±10%')
    })

    it('2.3 exposes formula pxPerCm = irisPx / 1.17', () => {
      expect(html).toContain('pxPerCm = irisPx / 1.17')
      expect(html).toContain('SCALE RATIO')
      expect(html).toContain('PIXEL DENSITY')
      expect(html).toContain('RENDER HEIGHT')
    })

    it('2.4 verifies mathematical derivations match lib/size.ts across test inputs', () => {
      const testCases = [
        { irisPx: 37, sizeCm: 2.0, expectedPx: 63 },
        { irisPx: 37, sizeCm: 3.0, expectedPx: 95 },
        { irisPx: 37, sizeCm: 4.5, expectedPx: 142 },
        { irisPx: 37, sizeCm: 6.0, expectedPx: 190 },
        { irisPx: 25, sizeCm: 3.0, expectedPx: 64 },
        { irisPx: 50, sizeCm: 3.0, expectedPx: 128 },
      ]

      for (const tc of testCases) {
        const computedDensity = pxPerCm(tc.irisPx, 11.7)
        const computedPx = Math.round(tc.sizeCm * computedDensity)
        expect(computedPx).toBe(tc.expectedPx)
      }
    })

    it('2.5 contains accessible slider and size selector chips', () => {
      expect(html).toContain('aria-label="Iris diameter in pixels"')
      expect(html).toContain('2.0 cm')
      expect(html).toContain('3.0 cm')
      expect(html).toContain('4.5 cm')
      expect(html).toContain('6.0 cm')
    })
  })

  describe('Section 3: Zero Photo Retention & Privacy Guarantee', () => {
    it('3.1 documents zero retention guarantee statement', () => {
      expect(html).toContain('Photos are processed exclusively for your session try-on pipeline with zero retention.')
      expect(html).toContain('zero retention')
    })

    it('3.2 visualizes 3-stage security and privacy lifecycle', () => {
      expect(html).toContain('01 / NORMALIZATION')
      expect(html).toContain('Local Ingestion &amp; EXIF Stripping')
      expect(html).toContain('02 / CRYPTOGRAPHY')
      expect(html).toContain('Cryptographic Hashing')
      expect(html).toContain('03 / DESTRUCTION')
      expect(html).toContain('Ephemeral Destruction')
    })

    it('3.3 renders architectural privacy comparison table', () => {
      expect(html).toContain('Architectural Privacy Comparison')
      expect(html).toContain('Facial Recognition')
      expect(html).toContain('Metadata &amp; GPS')
      expect(html).toContain('Data Retention')
      expect(html).toContain('AI Model Training')
      expect(html).toContain('Zero biometric templates')
    })
  })

  describe('Section 4: CyberLink YouCam API Integration & Unit Economics', () => {
    it('4.1 documents all integrated YouCam API endpoints with unit costs', () => {
      expect(html).toContain('2D VTO Earring')
      expect(html).toContain('/s2s/v2.0/task/2d-vto/earring')
      expect(html).toContain('Earring Stack')
      expect(html).toContain('2D VTO Necklace')
      expect(html).toContain('/s2s/v2.0/task/2d-vto/necklace')
      expect(html).toContain('Makeup VTO')
      expect(html).toContain('/s2s/v2.0/task/makeup-vto')
      expect(html).toContain('Hair Transfer')
      expect(html).toContain('/s2s/v2.1/task/hair-transfer')
      expect(html).toContain('Cloth V4')
      expect(html).toContain('/s2s/v2.0/task/cloth-v4')
    })

    it('4.2 documents anatomical pipeline execution order', () => {
      expect(html).toContain('ANATOMICAL PIPELINE')
      expect(html).toContain('OUTFIT (Cloth, 2u) → HAIR (Hair Transfer, 2u) → LIPSTICK (Makeup, 1u) → EARRING / NECKLACE (1u)')
    })

    it('4.3 explains zero-unit sample face caching and rate guardrails', () => {
      expect(html).toContain('CREDIT PRESERVATION')
      expect(html).toContain('Zero-Unit Sample Face Architecture')
      expect(html).toContain('f813b082')
      expect(html).toContain('20-unit reserve floor')
      expect(html).toContain('15-unit daily visitor cap')
    })
  })

  describe('Section 5: Editorial Call-to-Action Bar', () => {
    it('5.1 provides required primary and secondary action links', () => {
      expect(html).toContain('href="/p/gilded-teardrop?tryon=1"')
      expect(html).toContain('TRY ON ME')
      expect(html).toContain('href="/stylist"')
      expect(html).toContain('VIRTUAL STYLIST')
      expect(html).toContain('href="/"')
      expect(html).toContain('EXPLORE PIECES')
    })
  })

  describe('Accessibility & Layout Compliance', () => {
    it('enforces semantic heading hierarchy with h1 followed by h2', () => {
      expect(html).toContain('<h1')
      expect(html).toContain('<h2')
      const h1Index = html.indexOf('<h1')
      const h2Index = html.indexOf('<h2')
      expect(h1Index).toBeLessThan(h2Index)
    })

    it('enforces 2px --gold focus rings on interactive links and controls', () => {
      expect(html).toContain('focus-visible:outline-2')
      expect(html).toContain('focus-visible:outline-[var(--gold)]')
    })

    it('provides correct page metadata title and description', () => {
      expect(metadata.title).toBe('About Darpan · Kaari Studio')
      expect(metadata.description).toContain('true-size')
      expect(metadata.description).toContain('iris calibration')
    })

    it('renders server AboutPage component returning AboutClient', () => {
      const pageHtml = renderToString(React.createElement(AboutPage))
      expect(pageHtml).toContain('About')
      expect(pageHtml).toContain('Darpan means mirror.')
    })
  })
})
