import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getProductWithRuntime } from '@/lib/runtime-products'
import { ProductDetailClient } from './ProductDetailClient'

interface ProductPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params
  const product = await getProductWithRuntime(id)

  if (!product) {
    return {
      title: 'Product Not Found — Darpan',
      description: 'The requested piece could not be located in our atelier catalog.',
    }
  }

  return {
    title: `${product.name} — Virtual try-on | Darpan`,
    description: `Preview ${product.name} by ${product.brand}. Explore its appearance and estimated proportions before choosing.`,
    openGraph: {
      title: `${product.name} — Darpan Atelier`,
      description: `Virtual jewellery try-on with clear sizing assumptions.`,
      images: [
        {
          url: product.imagePath,
          width: 800,
          height: 1000,
          alt: product.name,
        },
      ],
    },
  }
}

export default async function ProductPage({ params, searchParams }: ProductPageProps & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params
  const product = await getProductWithRuntime(id)

  if (!product) {
    notFound()
  }
  const query = await searchParams
  if (query.tryon === '1' && product.type !== 'garment') {
    const size = typeof query.size === 'string' ? `?size=${encodeURIComponent(query.size)}` : ''
    redirect(`/try-on/${id}${size}`)
  }

  // Keyed by product so the selected size and gallery view reset when the shopper moves to another piece.
  return <ProductDetailClient key={product.id} product={product} />
}
