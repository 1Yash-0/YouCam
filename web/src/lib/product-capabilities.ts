import type { Product } from './products'

/** Use the orientation-aware image endpoint without altering the licensed source file. */
/**
 * Display cut-outs (transparent PNG, centred) made by scripts/catalogue/make-cutouts.mjs from the
 * museum photos' plain studio backgrounds. Display only: try-on uploads keep the original photo,
 * because ring and watch fitting geometry refers to its pixels.
 */
export const CUTOUT_IDS = new Set([
  'met-gold-earring', 'met-gold-pendant', 'met-snake-bracelet', 'met-carnelian-bracelet', 'met-open-cuff',
  'met-plasma-ring', 'met-bead-ring', 'met-carnelian-ring',
])

/** Photos shot on their own ground (wood, granite) that cannot be cut out cleanly: fill the frame (object-cover). */
export const FULL_BLEED_IDS = new Set(['atlantic-classic', 'marshal-petite'])
export const isFullBleedPhoto = (product: Pick<Product, 'id'>) => FULL_BLEED_IDS.has(product.id)

export function getProductDisplayImageUrl(product: Pick<Product, 'id' | 'imagePath'> & { sourceRotationDeg?: number }) {
  if (CUTOUT_IDS.has(product.id)) return `/products/cutout/${product.id}.png`
  return product.sourceRotationDeg ? `/api/products/${product.id}/image?orientation=${product.sourceRotationDeg}` : product.imagePath
}

/** Shared, browser-safe catalogue capabilities. Rendering support determines the controls. */
export function getProductCapabilities(product: Product) {
  const ear = product.type === 'single' || product.type === 'stud'
  const neck = product.type === 'necklace'
  const hand = product.type === 'ring'
  const sizes = ear ? (product.sizes?.length ? product.sizes : [product.heightCm]) : []
  let dimensionLabel = 'Appearance preview'
  let assumption = 'This AI preview does not establish physical fit.'
  if (ear) {
    dimensionLabel = `${product.heightCm} cm drop`
    assumption = 'Scale is estimated using an average 11.7 mm iris reference. Individual anatomy and AI rendering can change the result.'
  } else if (neck) {
    dimensionLabel = `${product.lengthCm} cm chain`
    assumption = 'Approximate drape.'
  } else if (product.type === 'ring') {
    dimensionLabel = product.stoneMm ? `${product.sizeEstimated ? 'About ' : ''}${product.stoneMm} mm stone` : `${product.diameterMm} mm overall diameter`
    assumption = product.ringSource ? 'Stone proportions are estimated from your selected US ring size. This cannot establish whether the ring fits.' : 'This ring uses automatic visual fitting. Its published dimensions do not guarantee the size shown.'
  } else if (product.type === 'watch') {
    dimensionLabel = `${product.sizeEstimated ? 'About ' : ''}${product.caseMm} mm case`
    assumption = 'Preview proportions assume a 60 mm wrist width. Your wrist and the rendered fit may differ.'
  } else if (product.type === 'bracelet') {
    dimensionLabel = `${product.diameterMm} mm diameter`
    assumption = 'Automatic visual fitting shows appearance only. Check the retailer’s wrist measurements before choosing.'
  }
  return {
    flow: (ear ? 'ear' : neck ? 'neck' : 'hand') as 'ear' | 'neck' | 'hand',
    photoKind: (hand ? 'hand' : product.type === 'watch' || product.type === 'bracelet' ? 'wrist' : 'portrait') as 'portrait' | 'hand' | 'wrist',
    calibration: ear,
    styling: ear || neck,
    sizes,
    sizeLabel: ear ? 'Drop length (cm)' : product.type === 'ring' ? 'US ring size' : 'Product dimensions',
    dimensionLabel,
    assumption,
    supported: product.type !== 'garment',
  }
}

export function selectionLabel(product: Product, sizeCm: number, ringSizeUs = 7, ringSizeKnown = false) {
  const c = getProductCapabilities(product)
  return c.calibration ? `${sizeCm} cm drop` : product.type === 'ring' ? `${c.dimensionLabel} · US ${ringSizeUs}${ringSizeKnown ? '' : ' assumed'}` : c.dimensionLabel
}
