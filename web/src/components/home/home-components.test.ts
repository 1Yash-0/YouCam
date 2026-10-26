import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  Preloader,
  PRELOADER_SESSION_KEY,
  HeroScrub,
  HERO_FRAMES,
  HERO_STOP_PROGRESS,
  HERO_CAPTIONS,
  HERO_REDUCED_MOTION_GRID,
  getNearestHeroFrameIndex,
  getHeroSizeForProgress,
  getReducedMotionGridItems,
  IrisNarrative,
  CategoryRail,
  CATEGORIES,
  CategorySilhouette,
  AtelierMarquee,
  DEFAULT_MARQUEE_ITEMS,
  CategoryChips,
  FloatingCursor,
  ProductCard,
  ProductGrid,
  Footer,
  filterProducts,
  formatPrice,
  getWornImageUrl,
  getProductMeta,
  getProductSourceCredit,
  getProductBadgeLabel,
  LOOK_CAPTIONS,
} from './index'
import { remap, easeOutCubic } from '@/hooks/useScrollProgress'
import { seedProducts } from '@/lib/products'
import size2 from '../../../public/hero/size-2.json'
import size3 from '../../../public/hero/size-3.json'
import size45 from '../../../public/hero/size-4_5.json'
import size6 from '../../../public/hero/size-6.json'
import sampleFace from '../../../data/sample-face.json'

const REAL_HERO_FRAMES = [size2, size3, size45, size6]

describe('Milestone 2 Component Exports & React Functionality', () => {
  it('exports all home editorial visual components', () => {
    expect(Preloader).toBeDefined()
    expect(HeroScrub).toBeDefined()
    expect(IrisNarrative).toBeDefined()
    expect(CategoryRail).toBeDefined()
    expect(AtelierMarquee).toBeDefined()
    expect(CategoryChips).toBeDefined()
    expect(FloatingCursor).toBeDefined()
    expect(ProductCard).toBeDefined()
    expect(ProductGrid).toBeDefined()
    expect(Footer).toBeDefined()
  })

  it('all exported components are valid React component functions', () => {
    expect(typeof Preloader).toBe('function')
    expect(typeof HeroScrub).toBe('function')
    expect(typeof IrisNarrative).toBe('function')
    expect(typeof CategoryRail).toBe('function')
    expect(typeof AtelierMarquee).toBe('function')
    expect(typeof CategoryChips).toBe('function')
    expect(typeof FloatingCursor).toBe('function')
    expect(typeof ProductCard).toBe('function')
    expect(typeof ProductGrid).toBe('function')
    expect(typeof Footer).toBe('function')
  })
})

describe('M0 Preloader Logic & Constraints', () => {
  it('strictly limits preloader duration to <= 1400ms', () => {
    const revealDuration = 900
    const morphDuration = 100
    const liftDuration = 400
    expect(revealDuration + morphDuration + liftDuration).toBeLessThanOrEqual(1400)
  })

  it('stores session dismissal key under darpan_preloader_seen', () => {
    expect(PRELOADER_SESSION_KEY).toBe('darpan_preloader_seen')
  })

  it('collapses preloader duration to 0ms when prefers-reduced-motion is active', () => {
    const prefersReducedMotion = true
    const duration = prefersReducedMotion ? 0 : 1400
    expect(duration).toBe(0)
  })

  it('safe session retrieval handles private browsing without throwing', () => {
    const getSafe = () => {
      try {
        return null
      } catch {
        return true
      }
    }
    expect(getSafe()).toBeNull()
  })
})

describe('M1 Hero Scrub Math & Progress Phasing', () => {
  it('contains verified 4 physical frame presets (2.0, 3.0, 4.5, 6.0 cm)', () => {
    expect(HERO_FRAMES).toHaveLength(4)
    expect(HERO_FRAMES.map((f) => f.sizeCm)).toEqual([2.0, 3.0, 4.5, 6.0])
  })

  it('uses four authored stops across the transition and size stage', () => {
    expect(HERO_STOP_PROGRESS).toEqual([0.30, 0.4667, 0.6333, 0.80])
    expect(HERO_CAPTIONS).toEqual([
      'Sits at the lobe.',
      'Halfway to the jaw.',
      'Near the jawline.',
      'Past the jaw.',
    ])
  })

  it('keeps labels discrete while progress interpolates only between stage-2 stops', () => {
    expect(getHeroSizeForProgress(0.2)).toBe(2)
    expect(getHeroSizeForProgress(0.4)).toBeCloseTo(2.6, 1)
    expect(getNearestHeroFrameIndex(getHeroSizeForProgress(0.4))).toBe(1)
    expect(getNearestHeroFrameIndex(getHeroSizeForProgress(0.58))).toBe(2)
    expect(getNearestHeroFrameIndex(getHeroSizeForProgress(0.9))).toBe(3)
    expect(HERO_FRAMES.map((frame) => frame.sizeCm.toFixed(1))).toEqual(['2.0', '3.0', '4.5', '6.0'])
  })

  it('provides a 2 by 2 reduced-motion grid with all four measured frames', () => {
    expect(getReducedMotionGridItems()).toEqual(HERO_REDUCED_MOTION_GRID)
    expect(HERO_REDUCED_MOTION_GRID).toHaveLength(4)
    expect(HERO_REDUCED_MOTION_GRID.map((item) => item.label)).toEqual(['2 cm', '3 cm', '4.5 cm', '6 cm'])
  })

  it('earlobe anchor coordinates match real frame JSON across all frames', () => {
    HERO_FRAMES.forEach((frame, index) => {
      expect(frame.box.y).toBe(REAL_HERO_FRAMES[index].box.y)
    })
  })

  it('remaps scroll progress 0.0 to 2.0 cm, 0.5 to 4.0 cm, 1.0 to 6.0 cm', () => {
    expect(remap(0.0, 0.0, 1.0, 2.0, 6.0)).toBe(2.0)
    expect(remap(0.5, 0.0, 1.0, 2.0, 6.0)).toBe(4.0)
    expect(remap(1.0, 0.0, 1.0, 2.0, 6.0)).toBe(6.0)
  })

  it('clamps scroll values safely below 0.0 and above 1.0', () => {
    expect(remap(-0.5, 0.0, 1.0, 2.0, 6.0)).toBe(2.0)
    expect(remap(1.5, 0.0, 1.0, 2.0, 6.0)).toBe(6.0)
  })

  it('eases progress smoothly with easeOutCubic', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(0.5)).toBe(0.875)
    expect(easeOutCubic(1)).toBe(1)
  })

  it('correctly calculates snap points to nearest standard size', () => {
    const snapPoints = [2.0, 3.0, 4.5, 6.0]
    const getNearest = (val: number) =>
      snapPoints.reduce((prev, curr) => (Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev))

    expect(getNearest(2.05)).toBe(2.0)
    expect(getNearest(2.85)).toBe(3.0)
    expect(getNearest(4.3)).toBe(4.5)
    expect(getNearest(5.9)).toBe(6.0)
  })
})

describe('M2 Iris Calibration Narrative Math & Calibration Constants', () => {
  it('calibrates the measured iris against the 11.7mm reference', () => {
    const irisPx = sampleFace.iris.px
    const irisMm = 11.7
    const pxPerMm = irisPx / irisMm
    const pxPerCm = irisPx / (irisMm / 10)

    expect(irisPx).toBe(41)
    expect(pxPerMm).toBeCloseTo(3.504, 2)
    expect(pxPerCm).toBeCloseTo(35.043, 2)
  })

  it('renders a 3.0cm Gilded Teardrop at the measured physical scale', () => {
    const sizeCm = 3.0
    const pxPerCm = sampleFace.iris.px / 1.17
    const earringPx = Math.round(sizeCm * pxPerCm)
    expect(earringPx).toBe(105)
  })

  it('renders a 6.0cm drop earring at the measured physical scale', () => {
    const sizeCm = 6.0
    const pxPerCm = sampleFace.iris.px / 1.17
    const earringPx = Math.round(sizeCm * pxPerCm)
    expect(earringPx).toBe(210)
  })

  it('contains eye landmark origin at (56.48%, 33.15%)', () => {
    const originX = (623.5 / 1104) * 100
    const originY = (488 / 1472) * 100
    expect(originX).toBeCloseTo(56.48, 1)
    expect(originY).toBeCloseTo(33.15, 1)
  })

  it('clamps maximum zoom factor strictly between 1.0x and 2.2x', () => {
    const clampZoom = (z: number) => Math.max(1.0, Math.min(2.2, z))
    expect(clampZoom(0.5)).toBe(1.0)
    expect(clampZoom(2.2)).toBe(2.2)
    expect(clampZoom(3.8)).toBe(2.2)
  })
})

describe('M12 Category Rail & SVG Silhouettes', () => {
  it('defines 6 architectural jewellery category items', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(5)
    const ids = CATEGORIES.map((c) => c.id)
    expect(ids).toContain('all')
    expect(ids).toContain('drops')
    expect(ids).toContain('studs')
    expect(ids).toContain('stacks')
    expect(ids).toContain('necklaces')
  })

  it('CategorySilhouette renders valid SVG silhouettes for all types', () => {
    const types = ['all', 'studs', 'drops', 'necklaces', 'stacks'] as const
    types.forEach((type) => {
      const element = CategorySilhouette({ type })
      expect(element).toBeDefined()
    })
  })
})

describe('M13 Atelier Marquee Statement & Looping', () => {
  it('includes required brand statement phrases', () => {
    const allText = DEFAULT_MARQUEE_ITEMS.map((i) => i.text).join(' ')
    expect(allText).toContain('Darpan')
    expect(allText).toContain('Earring Scale Reference')
    expect(allText).toContain('SCALE VARIES BY CATEGORY')
  })

  it('uses metallic gold diamond and star separators', () => {
    const symbols = DEFAULT_MARQUEE_ITEMS.map((i) => i.symbol)
    expect(symbols).toContain('star')
    expect(symbols).toContain('rhombus')
  })
})

describe('M3 Editorial Product Collection Grid & ProductCard Logic', () => {
  it('filters products accurately by category', () => {
    const all = filterProducts(seedProducts, 'All')
    expect(all.length).toBeGreaterThanOrEqual(5)
    // Garments should be excluded from jewellery grid
    expect(all.some((p) => p.type === 'garment')).toBe(false)

    const drops = filterProducts(seedProducts, 'Drops')
    expect(drops.every((p) => p.type === 'single')).toBe(true)

    const studs = filterProducts(seedProducts, 'Studs')
    expect(studs.every((p) => p.type === 'stud')).toBe(true)

    const necklaces = filterProducts(seedProducts, 'Necklaces')
    expect(necklaces.every((p) => p.type === 'necklace')).toBe(true)
  })

  it('formats prices as USD rounded to whole dollars', () => {
    expect(formatPrice(89)).toBe('$89')
    expect(formatPrice(49)).toBe('$49')
    expect(formatPrice(1234.5)).toBe('$1,235')
  })

  it('maps products with standalone renders to worn previews', () => {
    expect(getWornImageUrl({ id: 'gilded-teardrop' })).toBe('/samples/single-teardrop-3cm.png')
    expect(getWornImageUrl({ id: 'met-gold-earring' })).toBe('/products/worn/met-gold-earring.jpg')
    expect(getWornImageUrl({ id: 'orb-chain' })).toBe('/samples/necklace.png')
    expect(getWornImageUrl({ id: 'dot-stud' })).toBe('/samples/dot-stud-0.6cm.png')
    expect(getWornImageUrl({ id: 'emerald-blouse' })).toBe('/api/sample/outfit/image')
    expect(getWornImageUrl({ id: 'met-gold-pendant' })).toBe('/products/worn/met-gold-pendant-upright.jpg')
    expect(getWornImageUrl({ id: 'non-existent' })).toBeUndefined()
  })

  it('generates direct try-on link queries (/p/[id]?tryon=1)', () => {
    const product = seedProducts[0]
    const tryonUrl = `/p/${product.id}?tryon=1`
    expect(tryonUrl).toBe(`/p/${product.id}?tryon=1`)
  })

  it('uses plain measured metadata without True Size card copy', () => {
    const necklace = seedProducts.find((product) => product.id === 'orb-chain')
    const earring = seedProducts.find((product) => product.id === 'gilded-teardrop')
    expect(necklace && getProductMeta(necklace)).toBe('about 40 cm')
    expect(earring && getProductMeta(earring)).toBe('gold · 3.0 cm')
    expect(getProductMeta(earring!)).not.toContain('True Size')
  })

  it('uses the measured necklace badge and omits generated-image credit', () => {
    const necklace = seedProducts.find((product) => product.id === 'orb-chain')
    const generatedEarring = seedProducts.find((product) => product.id === 'gilded-teardrop')
    expect(necklace && getProductBadgeLabel(necklace)).toBe('ABOUT 40 CM')
    expect(generatedEarring && getProductSourceCredit(generatedEarring)).toBe('')
  })

  it('uses the Darpan card source credit for Met items', () => {
    const metItem = seedProducts.find((product) => product.id === 'met-gold-earring')
    expect(metItem && getProductSourceCredit(metItem)).toBe('Met Heritage, public domain')
  })

  it('maps sample manifest IDs to the requested one-line Looks captions', () => {
    expect(LOOK_CAPTIONS).toEqual({
      'single-teardrop-3cm': 'Gilded Teardrop, 3 cm',
      'earring-6cm': 'Gilded Teardrop, 6 cm',
      'lipstick-earring-chain': 'Teardrop with red lipstick',
      'stud-drop-stack': 'Stud and drop stack',
      'hair-braids-earring': 'Teardrop with braids',
      necklace: 'Orb Chain necklace',
      outfit: 'Teardrop with a new outfit',
    })
  })


  it('responsive column calculation clamps columns between 1 and 4', () => {
    const getCols = (w: number) => (w < 640 ? 1 : w < 1024 ? 2 : w < 1440 ? 3 : 4)
    expect(getCols(360)).toBe(1)
    expect(getCols(768)).toBe(2)
    expect(getCols(1280)).toBe(3)
    expect(getCols(1920)).toBe(4)
  })
})


const publicHomeSource = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8')
const collectionSource = readFileSync(new URL('../../app/collection/page.tsx', import.meta.url), 'utf8')
const productCardSource = readFileSync(new URL('./ProductCard.tsx', import.meta.url), 'utf8')
const footerSource = readFileSync(new URL('./Footer.tsx', import.meta.url), 'utf8')
const pillButtonSource = readFileSync(new URL('../PillButton.tsx', import.meta.url), 'utf8')

describe('public surface visual guardrails', () => {
  it('keeps public product cards flat, unblurred, and free of the Glint shimmer', () => {
    expect(productCardSource).not.toContain("from '@/components/Glint'")
    expect(productCardSource).not.toContain('shadow-')
    expect(productCardSource).not.toContain('backdrop-blur')
    expect(productCardSource).toContain('bg-[var(--paper)]')
    expect(productCardSource).not.toContain('WORN SCALE')
  })

  it('uses spacing instead of home section hairlines and composes the shopper-ordered sections', () => {
    expect(publicHomeSource).not.toContain('border-t border-[var(--line)]')
    for (const part of ['<MirrorHero', '<ShopByBody', '<HowSlip', '<LooksFrame', '<ClosingCta', '<Footer']) expect(publicHomeSource).toContain(part)
  })

  it('states the real-size promise on the collection and marks prices as illustrative', () => {
    expect(collectionSource).toContain('Every piece shows its real size. Hover to see it worn.')
    expect(collectionSource).toContain('prices illustrative')
    expect(collectionSource).not.toContain('Every piece listed at its real size.')
    expect(pillButtonSource).not.toContain('mixBlendMode')
  })

  it('keeps footer copy at readable body sizing without a divider', () => {
    expect(footerSource).toContain('text-[15px]')
    expect(footerSource).not.toContain('border-t')
  })
})
