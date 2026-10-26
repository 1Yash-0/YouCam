import { getAllProductsWithRuntime } from '@/lib/runtime-products'
import { Footer } from '@/components/home/Footer'
import { MirrorHero } from '@/components/home/MirrorHero'
import { ShopByBody } from '@/components/home/ShopByBody'
import { HowSlip } from '@/components/home/HowSlip'
import { LooksFrame } from '@/components/home/LooksFrame'
import { ClosingCta } from '@/components/home/ClosingCta'

export const dynamic = 'force-static'
export const revalidate = 60

// Order follows the shopper: see the real size (hero), pick a piece (shop), how it works (slip),
// what else it can do (looks), then try it on yourself (closing call to action).
export default async function HomePage() {
  const products = await getAllProductsWithRuntime()
  const jewellery = products.filter((product) => product.type !== 'garment')

  return (
    <main data-home-page className="home-page relative min-h-svh overflow-x-clip bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--gold)]/20">
      <MirrorHero />
      <ShopByBody products={jewellery} />
      <HowSlip />
      <LooksFrame />
      <ClosingCta />
      <Footer />
    </main>
  )
}
