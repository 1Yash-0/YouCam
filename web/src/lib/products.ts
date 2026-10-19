import { z } from 'zod'
import { uploadFile } from './youcam'
import { getJson, putJson, productMetaPath } from './storage'
import { AppError, ErrorCodes } from './errors'
import fs from 'fs'
import path from 'path'

export const ProductSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    type: z.literal('single'),
    heightCm: z.number().positive(),
    widthCm: z.number().positive(),
    metal: z.string(),
    priceInr: z.number().positive(),
    imagePath: z.string(), // Path under public/products/
    anchorPoint: z.tuple([z.number(), z.number()]).optional(),
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
    priceInr: z.number().positive(),
    imagePath: z.string(),
    anchorPoint: z.tuple([z.number(), z.number()]).optional(),
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
    priceInr: z.number().positive(),
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
    priceInr: z.number().positive(),
    imagePath: z.string(),
    source: z.string(),
    licence: z.string(),
  }),
])

export type Product = z.infer<typeof ProductSchema>

export interface ProductMeta {
  fileId: string
  uploadedAt: string
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

export async function ensureProductUploaded(product: Product): Promise<string> {
  const metaKey = productMetaPath(product.id)
  const meta = await getJson<ProductMeta>(metaKey)
  
  // Check if upload is still valid (25 days)
  if (meta?.uploadedAt) {
    const uploadedDate = new Date(meta.uploadedAt)
    const now = new Date()
    const daysSinceUpload = (now.getTime() - uploadedDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysSinceUpload < 25) {
      return meta.fileId
    }
  }
  
  // Need to upload
  try {
    // Read product image from public directory
    const fs = require('fs')
    const path = require('path')
    
    const imagePath = path.join(process.cwd(), 'public', product.imagePath)
    if (!fs.existsSync(imagePath)) {
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        `Product image not found: ${imagePath}`,
        404
      )
    }
    
    const imageBuffer = await fs.promises.readFile(imagePath)
    
    // Determine content type from file extension
    const ext = path.extname(product.imagePath).toLowerCase()
    const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    
    // Upload to YouCam
    const fileName = `${product.id}${ext}`
    const fileId = await uploadFile(imageBuffer, contentType, fileName)
    
    // Save metadata
    const newMeta: ProductMeta = {
      fileId,
      uploadedAt: new Date().toISOString(),
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
export async function getProductWithFileId(id: string): Promise<{
  product: Product
  fileId: string
} | null> {
  const product = await getProduct(id)
  if (!product) return null
  
  try {
    const fileId = await ensureProductUploaded(product)
    return { product, fileId }
  } catch {
    return null
  }
}