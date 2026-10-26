import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { ProductSchema, uploadVariant } from '@/lib/products'
import { planWatchFit, WATCH_FIT_K } from '@/lib/watch-fit'
import { WORN_IMAGE_MAP } from '@/components/home/ProductCard'

// Every catalogue entry must validate, and every watch must be fittable from its real photo.
const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'products.json'), 'utf-8')) as unknown[]

describe('catalogue', () => {
  it('marks only the Met pendant source for a 180 degree upload rotation', () => {
    const pendant = raw.map(item => ProductSchema.parse(item)).find(product => product.id === 'met-gold-pendant')
    expect(pendant?.type).toBe('single')
    if (!pendant || pendant.type !== 'single') throw new Error('Met pendant missing or has wrong product type')
    expect(pendant.sourceRotationDeg).toBe(180)
    expect(uploadVariant(pendant)).toBe('source-rotation:180')

    const otherEarrings = raw.map(item => ProductSchema.parse(item)).filter(product => (product.type === 'single' || product.type === 'stud') && product.id !== pendant.id)
    for (const product of otherEarrings) expect(uploadVariant(product)).toBeUndefined()
  })

  it('all products validate and their images exist', () => {
    for (const item of raw) {
      const p = ProductSchema.parse(item)
      expect(fs.existsSync(path.join(process.cwd(), 'public', p.imagePath)), p.id).toBe(true)
    }
  })

  it('reviewed worn previews point to existing assets', () => {
    const products = raw.map(i => ProductSchema.parse(i))
    expect(WORN_IMAGE_MAP['dot-stud']).toBe('/samples/dot-stud-0.6cm.png')
    for (const [productId, url] of Object.entries(WORN_IMAGE_MAP)) {
      expect(products.some(product => product.id === productId), productId).toBe(true)
      if (url.startsWith('/products/')) expect(fs.existsSync(path.join(process.cwd(), 'public', url)), productId).toBe(true)
      if (url.startsWith('/samples/')) expect(fs.existsSync(path.join(process.cwd(), 'public', url)), productId).toBe(true)
    }
  })

  for (const p of raw.map(i => ProductSchema.parse(i)).filter(p => p.type === 'watch')) {
    it(`${p.id}: geometry matches image and fit plan hits lug/wrist`, async () => {
      if (p.type !== 'watch') return
      const m = await sharp(path.join(process.cwd(), 'public', p.imagePath)).metadata()
      expect([m.width, m.height]).toEqual([p.watchSource.width, p.watchSource.height])
      const plan = planWatchFit(p.watchSource, p.lugToLugMm)
      const s = p.watchSource
      const extent = ((s.extentBottom ?? s.caseBottom) - (s.extentTop ?? s.caseTop)) * plan.scale
      const ratio = WATCH_FIT_K * extent / plan.strapSpan
      expect(ratio).toBeCloseTo(p.lugToLugMm / 60, 2)
    })
  }
})
