import { z } from 'zod'
import { uploadFile, rememberFile } from './youcam'
import { getJson, putJson, getFile, runtimeProductImagePath, productMetaPath } from './storage'
import { AppError, ErrorCodes } from './errors'
import { AVERAGE_WRIST_MM, MIN_STRAP_PX, WATCH_FIT_K, planWatchFit, renderWatchFit } from './watch-fit'
import { DEFAULT_RING_SIZE_US, RING_FIT_C, planRingFit, renderRingFit } from './ring-fit'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const ProductSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    type: z.literal('single'),
    heightCm: z.number().positive(),
    widthCm: z.number().positive(),
    metal: z.string(),
    priceUsd: z.number().positive(),
    imagePath: z.string(), // Path under public/products/
    anchorPoint: z.tuple([z.number(), z.number()]).optional(),
    sourceRotationDeg: z.union([z.literal(0), z.literal(180)]).optional(),
    sizes: z.array(z.number()).optional(),
    source: z.string(),
    licence: z.string(),
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    type: z.literal('stud'),
    heightCm: z.number().positive(),
    widthCm: z.number().positive(),
    metal: z.string(),
    priceUsd: z.number().positive(),
    imagePath: z.string(),
    anchorPoint: z.tuple([z.number(), z.number()]).optional(),
    sourceRotationDeg: z.union([z.literal(0), z.literal(180)]).optional(),
    sizes: z.array(z.number()).optional(),
    source: z.string(),
    licence: z.string(),
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    type: z.literal('necklace'),
    lengthCm: z.number().positive(),
    priceUsd: z.number().positive(),
    imagePath: z.string(),
    source: z.string(),
    licence: z.string(),
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    type: z.literal('garment'),
    garmentCategory: z.enum(['upper_body', 'lower_body', 'full_body', 'outer']),
    priceUsd: z.number().positive(),
    imagePath: z.string(),
    source: z.string(),
    licence: z.string(),
  }),
  // Hand pieces. Ring and bracelet render with the API's auto-fit (probes r3/r5: anchors do not give
  // reliable size control), so their real measurements are shown as labels, not used for scaling.
  // diameterMm = published overall (outer) size; widths are optional because sources often omit them.
  z.object({
    id: z.string(), name: z.string(), brand: z.string(), type: z.literal('ring'),
    diameterMm: z.number().positive(), bandWidthMm: z.number().positive().optional(), metal: z.string(), priceUsd: z.number().positive(),
    imagePath: z.string(), source: z.string(), licence: z.string(),
    /** Real stone length across the finger. With ringSource, the stone is rendered at this size (ring-fit.ts). */
    stoneMm: z.number().positive().optional(),
    sizeEstimated: z.boolean().optional(),
    ringSource: z.object({ stone: z.object({ cx: z.number(), cy: z.number(), rx: z.number().positive(), ry: z.number().positive() }), stoneLengthPx: z.number().positive(), hoopOuterPx: z.number().positive() }).optional(),
  }),
  z.object({
    id: z.string(), name: z.string(), brand: z.string(), type: z.literal('bracelet'),
    diameterMm: z.number().positive(), widthMm: z.number().positive().optional(), metal: z.string(), priceUsd: z.number().positive(),
    imagePath: z.string(), source: z.string(), licence: z.string(),
  }),
  // Watch is true-size: the uploaded image is refitted from lugToLugMm (see watch-fit.ts).
  z.object({
    id: z.string(), name: z.string(), brand: z.string(), type: z.literal('watch'),
    caseMm: z.number().positive(), lugToLugMm: z.number().positive(), priceUsd: z.number().positive(),
    imagePath: z.string(), source: z.string(), licence: z.string(),
    /** True when caseMm/lugToLugMm are estimated from the photo rather than a published spec. Shown in the UI. */
    sizeEstimated: z.boolean().optional(),
    /** Pixel geometry of the source photo along the strap centre line. Strap must run off both frame edges. */
    watchSource: z.object({ width: z.number().int().positive(), height: z.number().int().positive(), x: z.number(), strapBegin: z.number(), caseTop: z.number(), caseBottom: z.number(), strapEnd: z.number(), extentTop: z.number().optional(), extentBottom: z.number().optional() }),
  }),
])

export type Product = z.infer<typeof ProductSchema>

export interface ProductMeta {
  fileId: string
  uploadedAt: string
  /** Identifies a derived upload (watch fit). A mismatch forces re-upload. */
  variant?: string
}

export interface UploadOptions { ringSizeUs?: number }

type FittedRing = Extract<Product, { type: 'ring' }> & { stoneMm: number; ringSource: NonNullable<Extract<Product, { type: 'ring' }>['ringSource']> }

/** True when the ring is rendered true-size (needs a per-ring-size upload). */
export function isFittedRing(product: Product): product is FittedRing {
  return product.type === 'ring' && product.stoneMm !== undefined && product.ringSource !== undefined
}

export function uploadVariant(product: Product, opts: UploadOptions = {}): string | undefined {
  if (product.type === 'watch') return `fit:${product.lugToLugMm}:${WATCH_FIT_K}:${AVERAGE_WRIST_MM}:${MIN_STRAP_PX}`
  if (isFittedRing(product)) return `ringfit:${product.stoneMm}:${opts.ringSizeUs ?? DEFAULT_RING_SIZE_US}:${RING_FIT_C}`
  if ((product.type === 'single' || product.type === 'stud') && product.sourceRotationDeg) return `source-rotation:${product.sourceRotationDeg}`
  return undefined
}

// Load products from JSON file
function loadProducts(): Product[] {
  const productsPath = path.join(process.cwd(), 'data', 'products.json')
  
  if (!fs.existsSync(productsPath)) {
    console.warn(`Products file not found at ${productsPath}, using empty array`)
    return []
  }
  
  try {
    const data = fs.readFileSync(productsPath, 'utf-8')
    const parsed = JSON.parse(data)
    
    // Validate each product
    const products: Product[] = []
    for (const item of parsed) {
      try {
        const product = ProductSchema.parse(item)
        products.push(product)
      } catch (error) {
        console.error(`Invalid product ${item.id}:`, error)
      }
    }
    
    return products
  } catch (error) {
    console.error(`Failed to load products from ${productsPath}:`, error)
    return []
  }
}

// Seed products loaded from file
export const seedProducts: Product[] = loadProducts()

// Validate seed products
for (const product of seedProducts) {
  try {
    ProductSchema.parse(product)
  } catch (error) {
    console.error(`Invalid seed product ${product.id}:`, error)
  }
}

export async function getProduct(id: string): Promise<Product | null> {
  const product = seedProducts.find(p => p.id === id)
  if (!product) return null
  
  try {
    return ProductSchema.parse(product)
  } catch {
    return null
  }
}

export async function getAllProducts(): Promise<Product[]> {
  return seedProducts.filter(product => {
    try {
      ProductSchema.parse(product)
      return true
    } catch {
      return false
    }
  })
}

async function productUploadSource(product: Product, ringSize?: number) {
  const imagePath = path.join(process.cwd(), 'public', product.imagePath)
  let bytes: Buffer = product.imagePath.startsWith('/api/products/')
    ? (await getFile(runtimeProductImagePath(product.id))) || Buffer.alloc(0)
    : await fs.promises.readFile(imagePath)
  if (!bytes.length) throw new AppError(ErrorCodes.NOT_FOUND, 'Product image is unavailable.', 404)
  let ext = path.extname(product.imagePath).toLowerCase()
  if (product.imagePath.startsWith('/api/products/')) ext = '.png'
  if ((product.type === 'single' || product.type === 'stud') && product.sourceRotationDeg === 180) {
    bytes = await sharp(bytes).rotate(180).toBuffer()
  }
  if (product.type === 'watch') {
    bytes = await renderWatchFit(bytes, product.watchSource, planWatchFit(product.watchSource, product.lugToLugMm))
    ext = '.png'
  }
  if (isFittedRing(product)) {
    bytes = await renderRingFit(bytes, product.ringSource, planRingFit(product.ringSource, product.stoneMm, ringSize))
    ext = '.png'
  }
  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' as const : 'image/png' as const
  return { bytes, contentType, fileName: `${product.id}${ext}` }
}

export async function ensureProductUploaded(product: Product, opts: UploadOptions = {}): Promise<string> {
  // fitted rings upload one prepared photo per ring size
  const ringSize = isFittedRing(product) ? (opts.ringSizeUs ?? DEFAULT_RING_SIZE_US) : undefined
  const metaKey = productMetaPath(ringSize === undefined ? product.id : `${product.id}@us${ringSize}`)
  const meta = await getJson<ProductMeta>(metaKey)
  const variant = uploadVariant(product, opts)
  
  // Check if upload is still valid (25 days)
  if (meta?.uploadedAt && meta.variant === variant) {
    const uploadedDate = new Date(meta.uploadedAt)
    const now = new Date()
    const daysSinceUpload = (now.getTime() - uploadedDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysSinceUpload < 25) {
      await rememberFile(meta.fileId, () => productUploadSource(product, ringSize))
      return meta.fileId
    }
  }
  
  // Need to upload
  try {
    const source = await productUploadSource(product, ringSize)
    const fileId = await uploadFile(source.bytes, source.contentType, source.fileName)
    
    // Save metadata
    const newMeta: ProductMeta = {
      fileId,
      uploadedAt: new Date().toISOString(),
      ...(variant ? { variant } : {}),
    }
    
    await putJson(metaKey, newMeta)
    
    return fileId
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }
    
    throw new AppError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to upload product image: ${error instanceof Error ? error.message : String(error)}`,
      500
    )
  }
}

// Helper function to get product with fileId
export async function getProductWithFileId(id: string, opts: UploadOptions = {}): Promise<{
  product: Product
  fileId: string
} | null> {
  const product = await getProduct(id) || await (await import('./runtime-products')).getProductWithRuntime(id)
  if (!product) return null
  
  try {
    const fileId = await ensureProductUploaded(product, opts)
    return { product, fileId }
  } catch {
    return null
  }
}
