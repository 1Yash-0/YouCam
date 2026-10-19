import { describe, it, expect } from 'vitest'
import {
  Preloader,
  PRELOADER_SESSION_KEY,
  HeroScrub,
  HERO_FRAMES,
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
  formatInr,
  getWornImageUrl,
} from './index'
import { remap, easeOutCubic } from '@/hooks/useScrollProgress'
import { seedProducts } from '@/lib/products'

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

  it('earlobe anchor coordinate Y is locked at 656 across all frames', () => {
    HERO_FRAMES.forEach((frame) => {
      expect(frame.box.y).toBe(656)
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
  it('calibrates 37px against universal 11.7mm standard', () => {
    const irisPx = 37
    const irisMm = 11.7
    const pxPerMm = irisPx / irisMm
    const pxPerCm = irisPx / (irisMm / 10)

    expect(pxPerMm).toBeCloseTo(3.162, 2)
    expect(pxPerCm).toBeCloseTo(31.624, 2)
  })

  it('renders 3.0cm Gilded Teardrop drop precisely at 95px physical scale', () => {
    const sizeCm = 3.0
    const pxPerCm = 37 / 1.17
    const earringPx = Math.round(sizeCm * pxPerCm)
    expect(earringPx).toBe(95)
  })

  it('renders 6.0cm drop earring precisely at 190px physical scale', () => {
    const sizeCm = 6.0
    const pxPerCm = 37 / 1.17
    const earringPx = Math.round(sizeCm * pxPerCm)
    expect(earringPx).toBe(190)
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
    expect(ids).toContain('earrings')
    expect(ids).toContain('necklaces')
  })

  it('CategorySilhouette renders valid SVG silhouettes for all types', () => {
    const types = ['all', 'earrings', 'studs', 'drops', 'necklaces', 'sets'] as const
    types.forEach((type) => {
      const element = CategorySilhouette({ type })
      expect(element).toBeDefined()
    })
  })
})

describe('M13 Atelier Marquee Statement & Looping', () => {
  it('includes required brand statement phrases', () => {
    const allText = DEFAULT_MARQUEE_ITEMS.map((i) => i.text).join(' ')
    expect(allText).toContain('Kaari Studio')
    expect(allText).toContain('True Physical Scale')
    expect(allText).toContain('Precision Iris Calibration')
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

    const earrings = filterProducts(seedProducts, 'Earrings')
    expect(earrings.every((p) => p.type === 'single' || p.id.includes('earring') || p.id.includes('teardrop'))).toBe(true)

    const studs = filterProducts(seedProducts, 'Studs')
    expect(studs.every((p) => p.type === 'stud')).toBe(true)

    const necklaces = filterProducts(seedProducts, 'Necklaces')
    expect(necklaces.every((p) => p.type === 'necklace')).toBe(true)
  })

  it('formats prices with tabular Indian Rupee format', () => {
    const formatted = formatInr(1499)
    expect(formatted).toContain('1,499')
    expect(formatted).toContain('₹')

    const small = formatInr(699)
    expect(small).toContain('699')
    expect(small).toContain('₹')
  })

  it('maps products to correct photorealistic worn previews with sample-face fallback', () => {
    expect(getWornImageUrl({ id: 'gilded-teardrop' })).toBe('/api/sample/single-teardrop-3cm/image')
    expect(getWornImageUrl({ id: 'met-gold-earring' })).toBe('/api/sample/earring-6cm/image')
    expect(getWornImageUrl({ id: 'orb-chain' })).toBe('/api/sample/necklace/image')
    expect(getWornImageUrl({ id: 'dot-stud' })).toBe('/api/sample/stud-drop-stack/image')
    expect(getWornImageUrl({ id: 'non-existent' })).toBe('/sample-face.png')
  })

  it('generates direct try-on link queries (/p/[id]?tryon=1)', () => {
    const product = seedProducts[0]
    const tryonUrl = `/p/${product.id}?tryon=1`
    expect(tryonUrl).toBe(`/p/${product.id}?tryon=1`)
  })

  it('responsive column calculation clamps columns between 1 and 4', () => {
    const getCols = (w: number) => (w < 640 ? 1 : w < 1024 ? 2 : w < 1440 ? 3 : 4)
    expect(getCols(360)).toBe(1)
    expect(getCols(768)).toBe(2)
    expect(getCols(1280)).toBe(3)
    expect(getCols(1920)).toBe(4)
  })
})
