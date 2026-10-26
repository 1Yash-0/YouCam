import { z } from 'zod'
import { getJson, putJson, putFile, runtimeProductsPath, runtimeProductImagePath, productMetaPath } from './storage'
import { seedProducts, ProductSchema, Product } from './products'
import { AppError, ErrorCodes } from './errors'
import sharp from 'sharp'
import crypto from 'crypto'

// Runtime product schema (same as Product but with optional source/licence)
const RuntimeProductSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    type: z.literal('single'),
    heightCm: z.number().positive(),
    widthCm: z.number().positive(),
    metal: z.string(),
    priceUsd: z.number().positive(),
    imagePath: z.string(),
    anchorPoint: z.tuple([z.number(), z.number()]).optional(),
    sourceRotationDeg: z.union([z.literal(0), z.literal(180)]).optional(),
    sizes: z.array(z.number()).optional(),
    source: z.string().optional().default('Runtime addition'),
    licence: z.string().optional().default('Runtime addition'),
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
    source: z.string().optional().default('Runtime addition'),
    licence: z.string().optional().default('Runtime addition'),
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    type: z.literal('necklace'),
    lengthCm: z.number().positive(),
    priceUsd: z.number().positive(),
    imagePath: z.string(),
    source: z.string().optional().default('Runtime addition'),
    licence: z.string().optional().default('Runtime addition'),
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    type: z.literal('garment'),
    garmentCategory: z.enum(['upper_body', 'lower_body', 'full_body', 'outer']),
    priceUsd: z.number().positive(),
    imagePath: z.string(),
    source: z.string().optional().default('Runtime addition'),
    licence: z.string().optional().default('Runtime addition'),
  }),
])

export type RuntimeProduct = z.infer<typeof RuntimeProductSchema>
type RuntimeProductInput<T = RuntimeProduct> = T extends RuntimeProduct ? Omit<T, 'source' | 'licence' | 'imagePath'> & { imagePath?: string } : never

// Load runtime products from storage
export async function loadRuntimeProducts(): Promise<RuntimeProduct[]> {
  const products = await getJson<RuntimeProduct[]>(runtimeProductsPath())
  return products || []
}

// Save runtime products to storage
export async function saveRuntimeProducts(products: RuntimeProduct[]): Promise<void> {
  await putJson(runtimeProductsPath(), products)
}

// Get all products (seed + runtime)
export async function getAllProductsWithRuntime(): Promise<Product[]> {
  const runtimeProducts = await loadRuntimeProducts()
  const seedProductIds = new Set(seedProducts.map(p => p.id))
  
  // Filter out runtime products that have the same ID as seed products
  const uniqueRuntimeProducts = runtimeProducts.filter(p => !seedProductIds.has(p.id))
  
  return [...seedProducts, ...uniqueRuntimeProducts]
}

// Get a single product (seed or runtime)
export async function getProductWithRuntime(id: string): Promise<Product | null> {
  // First check seed products
  const seedProduct = seedProducts.find(p => p.id === id)
  if (seedProduct) {
    return seedProduct
  }
  
  // Then check runtime products
  const runtimeProducts = await loadRuntimeProducts()
  const runtimeProduct = runtimeProducts.find(p => p.id === id)
  if (!runtimeProduct) {
    return null
  }
  
  // Validate runtime product
  try {
    return ProductSchema.parse(runtimeProduct)
  } catch {
    return null
  }
}

// Check if product is a runtime product
export async function isRuntimeProduct(id: string): Promise<boolean> {
  const seedProduct = seedProducts.find(p => p.id === id)
  if (seedProduct) {
    return false
  }
  
  const runtimeProducts = await loadRuntimeProducts()
  return runtimeProducts.some(p => p.id === id)
}

// Create a new runtime product
export async function createRuntimeProduct(
  productData: RuntimeProductInput,
  imageBuffer: Buffer
): Promise<RuntimeProduct> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productData.id) || productData.id.length > 80) throw new AppError(ErrorCodes.INVALID_INPUT, 'Use a short lowercase product slug.', 400)
  // Validate product data
  const validatedProduct = RuntimeProductSchema.parse({
    ...productData,
    imagePath: `/api/products/${productData.id}/image`,
    source: 'Runtime addition',
    licence: 'Runtime addition',
  })
  
  // Check for ID collisions with seed products
  const seedProduct = seedProducts.find(p => p.id === validatedProduct.id)
  if (seedProduct) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      'Product ID already exists in seed data',
      409
    )
  }
  
  // Check for ID collisions with runtime products
  const runtimeProducts = await loadRuntimeProducts()
  const existingRuntimeProduct = runtimeProducts.find(p => p.id === validatedProduct.id)
  if (existingRuntimeProduct) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      'Product ID already exists',
      409
    )
  }
  
  // Validate and process image
  const processedImage = await processProductImage(imageBuffer)
  
  // Save image
  const imagePath = runtimeProductImagePath(validatedProduct.id)
  await putFile(imagePath, processedImage)
  
  // Add to runtime products
  runtimeProducts.push(validatedProduct)
  await saveRuntimeProducts(runtimeProducts)
  
  return validatedProduct
}

// Update a runtime product
export async function updateRuntimeProduct(
  id: string,
  updates: Partial<{
    anchorPoint: [number, number]
    sizes: number[]
    priceUsd: number
    heightCm: number
  }>
): Promise<RuntimeProduct> {
  // Check if product is a runtime product
  if (!(await isRuntimeProduct(id))) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      'Cannot update seed product',
      403
    )
  }
  
  const runtimeProducts = await loadRuntimeProducts()
  const productIndex = runtimeProducts.findIndex(p => p.id === id)
  
  if (productIndex === -1) {
    throw new AppError(
      ErrorCodes.NOT_FOUND,
      'Runtime product not found',
      404
    )
  }
  
  // Validate updates
  const updatedProduct = RuntimeProductSchema.parse({
    ...runtimeProducts[productIndex],
    ...updates,
  })
  
  // Update product
  runtimeProducts[productIndex] = updatedProduct
  await saveRuntimeProducts(runtimeProducts)
  
  return updatedProduct
}

// Delete a runtime product
export async function deleteRuntimeProduct(id: string): Promise<void> {
  // Check if product is a runtime product
  if (!(await isRuntimeProduct(id))) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      'Cannot delete seed product',
      403
    )
  }
  
  const runtimeProducts = await loadRuntimeProducts()
  const productIndex = runtimeProducts.findIndex(p => p.id === id)
  
  if (productIndex === -1) {
    throw new AppError(
      ErrorCodes.NOT_FOUND,
      'Runtime product not found',
      404
    )
  }
  
  // Remove product
  runtimeProducts.splice(productIndex, 1)
  await saveRuntimeProducts(runtimeProducts)
  
  // Invalidate cached YouCam file_id meta
  const metaKey = productMetaPath(id)
  await putJson(metaKey, null)
  
  // Note: We don't delete the actual image file to avoid issues
  // if there are pending operations
}

// Process product image (normalize to PNG, resize if needed)
async function processProductImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()
    
    // Check image size
    if (!metadata.width || !metadata.height) {
      throw new AppError(
        ErrorCodes.INVALID_INPUT,
        'Invalid image dimensions',
        400
      )
    }
    
    // Get long side
    const longSide = Math.max(metadata.width, metadata.height)
    
    // Resize if long side > 1500
    if (longSide > 1500) {
      if (metadata.width > metadata.height) {
        image.resize(1500, undefined, { fit: 'inside' })
      } else {
        image.resize(undefined, 1500, { fit: 'inside' })
      }
    }
    
    // Convert to PNG
    const processedBuffer = await image.png().toBuffer()
    
    return processedBuffer
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }
    
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      'Failed to process image',
      400
    )
  }
}
