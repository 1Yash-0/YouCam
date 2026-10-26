import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ToastProvider } from '@/components/Toast'
import type { Product } from '@/lib/products'
import type { TryOnState } from './types'
import { ResultStep } from './ResultStep'

const ring: Product = {
  id: 'met-carnelian-ring', name: 'Carnelian Swivel Ring', brand: 'Met', type: 'ring',
  diameterMm: 27, stoneMm: 15, sizeEstimated: true, metal: 'gold', priceUsd: 170,
  imagePath: '/products/ring.jpg', source: 'Met', licence: 'CC0',
}

function state(overrides: Partial<TryOnState> = {}): TryOnState {
  return {
    isOpen: true, step: 'result', previousStep: null, productId: ring.id, sizeCm: 3,
    photoId: 'photo-id', photoUrl: '/upload/session-photo.jpg', photoDimensions: { width: 1000, height: 1200 },
    isSampleFace: false, irisPx: 40, irisMm: 11.7, ear: 'right', zoom: 1,
    caliperCoords: { x: 0, y: 0 }, jobId: null, activeSteps: [], stepIndex: 0,
    totalSteps: 1, currentStepName: 'render', hairlineProgress: 1, resultKey: 'key',
    resultImageUrl: '/api/result/session-image.png', baseResultImageUrl: null, baseMeasurement: null, renderedCm: null,
    tolerancePct: 10, withinTolerance: true, showRuler: true, compareMode: 'original',
    splitPosition: 50, measurement: null, extras: {}, isPresetRendering: false,
    cachedPresets: new Set(), error: null, finger: 3, ringSizeUs: 7, ringSizeKnown: false,
    ...overrides,
  } as TryOnState
}

function render(product: Product, tryOnState: TryOnState) {
  return renderToStaticMarkup(
    <ToastProvider>
      <ResultStep
        state={tryOnState} product={product} onToggleRuler={() => {}}
        onSetCompareMode={() => {}} onSliderPositionChange={() => {}}
        onCompareSize={() => {}}
        onToggleLipstick={() => {}} onToggleHairUp={() => {}} onToggleOutfit={() => {}}
        onToggleStack={() => {}} onSelectLipstickShade={() => {}} onAddToCart={() => {}}
        onRecalibrate={() => {}}
      />
    </ToastProvider>,
  )
}

describe('ResultStep honesty and layout', () => {
  it('does not show a green size verdict when there is no measurement', () => {
    const html = render(ring, state())
    expect(html).not.toContain('Within tolerance')
    expect(html).not.toContain('±12%')
    expect(html).not.toContain('RULER')
    expect(html).toContain('15 mm stone')
    expect(html).toContain('automatic visual fitting')
  })

  it('says a face scale estimate is unavailable when that render has no measurement', () => {
    const earring: Product = {
      id: 'earring', name: 'Drop', brand: 'Darpan', type: 'single', heightCm: 3,
      widthCm: 1, metal: 'gold', priceUsd: 89, imagePath: '/products/earring.png',
      source: 'Demo', licence: 'Generated',
    }
    const html = render(earring, state({ productId: earring.id, sizeCm: 6 }))
    expect(html).not.toContain('Within tolerance')
    expect(html).toContain('Size estimate unavailable for this render.')
    expect(html).toContain('6 cm drop')
    expect(html).not.toContain('3 cm drop')
  })

  it('puts every supported personal earring size in the result before a second comparison exists', () => {
    const earring: Product = {
      id: 'earring', name: 'Drop', brand: 'Darpan', type: 'single', heightCm: 3,
      widthCm: 1, metal: 'gold', priceUsd: 89, imagePath: '/products/earring.png',
      sizes: [3, 6], source: 'Demo', licence: 'Generated',
    }
    const html = render(earring, state({ productId: earring.id }))
    expect(html).toContain('Drop length')
    expect(html).toContain('3 cm')
    expect(html).toContain('6 cm')
  })

  it('uses a genuine demo label and clear styling guidance on the teardrop sample', () => {
    const teardrop: Product = {
      id: 'gilded-teardrop', name: 'Gilded Teardrop', brand: 'Darpan', type: 'single', heightCm: 3,
      widthCm: 1.3, sizes: [3, 6], metal: 'gold', priceUsd: 89, imagePath: '/products/teardrop.png',
      source: 'Demo', licence: 'Generated',
    }
    const html = render(teardrop, state({ productId: teardrop.id, isSampleFace: true }))
    expect(html).toContain('Sample result: pre-recorded YouCam demo')
    expect(html).toContain('Use your own photo to try every size and styling.')
    expect(html).not.toContain('This sample combines a stud and a drop')
    expect(html).toContain('Upload your photo to try this size.')
  })

  it('keeps the image visible on short mobile layouts and allocates a wider desktop image column', () => {
    const html = render(ring, state())
    expect(html).toContain('min-h-[320px]')
    expect(html).toContain('lg:grid-cols-[minmax(0,62fr)_minmax(320px,38fr)]')
  })
})
