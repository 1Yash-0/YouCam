import { getAllProductsWithRuntime } from '@/lib/runtime-products'
import {
  Preloader,
  HeroScrub,
  CategoryRail,
  ProductGrid,
  IrisNarrative,
  AtelierMarquee,
  Footer,
} from '@/components/home'

export const dynamic = 'force-static'
export const revalidate = 60

export default async function HomePage() {
  const products = await getAllProductsWithRuntime()

  return (
    <main className="relative min-h-screen bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--gold)]/20 overflow-x-clip">
      {/* M0: Preloader with masked wordmark reveal (max 1.4s, sessionStorage) */}
      <Preloader />

      {/* M1: Signature Hero Size Scrub (240vh scroll spacer with physical scale canvas) */}
      <section id="hero" aria-label="Hero Size Experience">
        <HeroScrub />
      </section>

      {/* M12: Category Silhouette Rail */}
      <nav id="categories" aria-label="Product Categories">
        <CategoryRail />
      </nav>

      {/* M3: Editorial Product Collection Grid */}
      <section id="collection" aria-label="Jewellery Collection" className="scroll-mt-24">
        <ProductGrid initialProducts={products} />
      </section>

      {/* M2: Pinned How It Works Iris Ruler Narrative (300vh scroll) */}
      <section id="narrative" aria-label="How Iris Calibration Works">
        <IrisNarrative />
      </section>

      {/* M13: Atelier Marquee */}
      <section id="marquee" aria-label="Atelier Signatures">
        <AtelierMarquee />
      </section>

      {/* Editorial Footer */}
      <Footer />
    </main>
  )
}