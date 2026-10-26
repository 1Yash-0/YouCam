import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createRuntimeProduct } = vi.hoisted(() => ({ createRuntimeProduct: vi.fn() }))

vi.mock('@/lib/env', () => ({ env: { ADMIN_TOKEN: 'test-admin-token' } }))
vi.mock('@/lib/runtime-products', () => ({ createRuntimeProduct }))

import { POST } from './route'

function productForm(id: string, image: File) {
  const form = new FormData()
  form.set('id', id)
  form.set('name', 'Test earring')
  form.set('brand', 'Test brand')
  form.set('type', 'single')
  form.set('priceUsd', '20')
  form.set('heightCm', '3')
  form.set('widthCm', '1')
  form.set('image', image)
  return form
}

function post(form: FormData) {
  return POST(new NextRequest('http://localhost/api/admin/products', {
    method: 'POST',
    headers: { 'x-admin-token': 'test-admin-token' },
    body: form,
  }))
}

describe('POST /api/admin/products validation', () => {
  beforeEach(() => createRuntimeProduct.mockReset())

  it('rejects product IDs that are not lowercase hyphenated slugs', async () => {
    const response = await post(productForm('Invalid/ID', new File(['image'], 'ear.png', { type: 'image/png' })))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_INPUT' })
    expect(createRuntimeProduct).not.toHaveBeenCalled()
  })

  it('rejects uploads larger than 4 MB before processing the product', async () => {
    const image = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'ear.png', { type: 'image/png' })
    const response = await post(productForm('valid-earring', image))

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: 'INVALID_INPUT' })
    expect(createRuntimeProduct).not.toHaveBeenCalled()
  })

  it('accepts the allowed image formats within the size limit', async () => {
    createRuntimeProduct.mockResolvedValue({ id: 'valid-earring', name: 'Test earring', type: 'single' })
    const response = await post(productForm('valid-earring', new File(['image'], 'ear.webp', { type: 'image/webp' })))

    expect(response.status).toBe(201)
    expect(createRuntimeProduct).toHaveBeenCalledOnce()
  })
})
