import { notFound } from 'next/navigation'
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

  const sizeDesc = 'heightCm' in product ? `${product.heightCm} cm` : 'custom scale'

  return {
    title: `${product.name} — See it at actual size | Darpan`,
    description: `Experience the ${product.name} by ${product.brand} at actual size (${sizeDesc}). True-scale virtual jewellery try-on measured against your own iris.`,
    openGraph: {
      title: `${product.name} — Darpan Atelier`,
      description: `Virtual jewellery try-on calibrated to 11.7 mm iris baseline.`,
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

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params
  const product = await getProductWithRuntime(id)

  if (!product) {
    notFound()
  }

  return <ProductDetailClient product={product} />
}
