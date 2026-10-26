'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { TryOnDrawer } from '@/components/tryon/TryOnDrawer'
import type { Product } from '@/lib/products'
import { getProductCapabilities } from '@/lib/product-capabilities'
export function TryOnStudioClient({ product }: { product: Product }) {
  const router = useRouter(); const query = useSearchParams()
  const requested = Number(query.get('size'))
  const size = getProductCapabilities(product).sizes.includes(requested) ? requested : undefined
  return <TryOnDrawer key={product.id} isOpen onClose={() => router.push(`/p/${product.id}`)} product={product} initialSizeCm={size} />
}
