import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { getProductWithRuntime } from '@/lib/runtime-products'
import { TryOnStudioClient } from './studio-client'
export const dynamic = 'force-dynamic'
export default async function Studio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProductWithRuntime(id)
  if (!product) notFound()
  if (product.type === 'garment') redirect(`/p/${id}`)
  return <Suspense fallback={<p className="p-10">Opening studio…</p>}><TryOnStudioClient product={product} /></Suspense>
}
