import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
const memory = vi.hoisted(() => ({ json: new Map<string, unknown>(), files: new Map<string, Buffer>() }))
vi.mock('@/lib/youcam', () => ({ uploadFile: vi.fn(), rememberFile: vi.fn() }))
vi.mock('@/lib/storage', () => ({
  getJson: async (key: string) => memory.json.get(key) ?? null,
  putJson: async (key: string, value: unknown) => { memory.json.set(key, value) },
  putFile: async (key: string, value: Buffer) => { memory.files.set(key, value) },
  getFile: async (key: string) => memory.files.get(key) ?? null,
  runtimeProductsPath: () => 'runtime-products.json', runtimeProductImagePath: (id: string) => `products/${id}.png`, productMetaPath: (id: string) => `meta/products/${id}.json`,
}))
import { createRuntimeProduct, getProductWithRuntime } from '@/lib/runtime-products'
beforeEach(() => { memory.json.clear(); memory.files.clear() })
describe('retailer product persistence', () => {
  it('creates a shopper-ready product from the editor fields and stores actual PNG bytes', async () => {
    const image = await sharp({ create: { width: 20, height: 30, channels: 4, background: '#b08a3e' } }).png().toBuffer()
    const product = await createRuntimeProduct({ id: 'sprint-test-earring', name: 'Retailer sample', brand: 'Test', type: 'single', heightCm: 3, widthCm: 1.5, metal: 'gold', priceUsd: 50 }, image)
    expect(product.imagePath).toBe('/api/products/sprint-test-earring/image')
    expect(await getProductWithRuntime(product.id)).toEqual(product)
    expect(Buffer.isBuffer(memory.files.get('products/sprint-test-earring.png'))).toBe(true)
    expect((await sharp(memory.files.get('products/sprint-test-earring.png')).metadata()).format).toBe('png')
  })
})
