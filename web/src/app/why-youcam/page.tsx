import type { Metadata } from 'next'
import Link from 'next/link'
import { YouCamAdvantageSection } from '@/components/home/YouCamAdvantageSection'

export const metadata: Metadata = {
  title: 'Why YouCam API · Darpan',
  description:
    'Why Perfect Corp YouCam API provides the physical scale accuracy, facial identity preservation, and product fidelity needed for fine jewellery virtual try-on.',
}

export default function WhyYouCamPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      {/* Editorial Header */}
      <header className="mx-auto max-w-6xl px-6 pb-6 pt-[calc(var(--header-h)+5rem)] sm:px-10 lg:px-16">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-[var(--ink-2)]">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors underline decoration-[var(--line)]">Home</Link>
          <span aria-hidden="true" className="text-[var(--line)]">/</span>
          <span className="text-[var(--ink)]">Why YouCam API</span>
        </nav>

        <div className="max-w-3xl">
          <h1 className="font-display text-5xl leading-[1.02] tracking-[-0.035em] sm:text-7xl">
            Why YouCam API.
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-[var(--ink-2)] sm:text-xl">
            Fine jewellery requires sub-millimeter precision, true facial likeness, and catalog product fidelity. 
            Here is why specialized computer vision succeeds where generic text-to-image diffusion fails.
          </p>
        </div>
      </header>

      {/* Main Section */}
      <div className="mx-auto max-w-6xl px-6 pb-12 sm:px-10 lg:px-16">
        <YouCamAdvantageSection />
      </div>

      {/* Editorial Deep Dive */}
      <section className="mx-auto max-w-6xl px-6 pb-24 sm:px-10 lg:px-16">
        <div className="border-t border-[var(--line)] pt-12">
          <h2 className="font-display text-3xl sm:text-4xl text-[var(--ink)]">
            Computer vision physics versus generative diffusion
          </h2>
          <p className="mt-3 max-w-2xl text-base text-[var(--ink-2)] leading-relaxed">
            Darpan separates geometric scaling and physical placement from conversational styling advice.
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div className="border border-[var(--line)] bg-[var(--paper)] p-8 space-y-4">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--gold)]">
                The limits of text-to-image models
              </span>
              <h3 className="font-display text-2xl text-[var(--ink)]">
                Why prompting an LLM fails for fine jewellery
              </h3>
              <p className="text-sm leading-relaxed text-[var(--ink-2)]">
                When a diffusion model is asked to render jewelry onto a portrait, it resynthesizes pixels from noise rather than calculating spatial metrics. In retail, this causes critical failures:
              </p>
              <ul className="space-y-2 text-sm text-[var(--ink-2)] list-disc pl-5">
                <li><strong className="text-[var(--ink)] font-medium">Unverifiable scale:</strong> Text prompts have no concept of physical millimeters, causing earrings or dials to appear at arbitrary sizes.</li>
                <li><strong className="text-[var(--ink)] font-medium">Facial distortion:</strong> Inpainting alters natural facial geometry, skin texture, and lighting, creating an uncanny likeness.</li>
                <li><strong className="text-[var(--ink)] font-medium">Non-existent inventory:</strong> Diffusion invents decorative details that do not exist on the retailer’s actual shelf.</li>
              </ul>
            </div>

            <div className="border border-[var(--line)] bg-[var(--paper)] p-8 space-y-4">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--gold)]">
                The YouCam approach
              </span>
              <h3 className="font-display text-2xl text-[var(--ink)]">
                Deterministic landmarks and physical anchors
              </h3>
              <p className="text-sm leading-relaxed text-[var(--ink-2)]">
                Perfect Corp’s YouCam API decouples biometric recognition from synthetic imagery:
              </p>
              <ul className="space-y-2 text-sm text-[var(--ink-2)] list-disc pl-5">
                <li><strong className="text-[var(--ink)] font-medium">Biometric grounding:</strong> Exact tracking of iris diameter (11.7 mm average), lobule attachment, and clavicle width.</li>
                <li><strong className="text-[var(--ink)] font-medium">Zero face alteration:</strong> The customer&apos;s natural skin, pores, and facial structure remain completely authentic.</li>
                <li><strong className="text-[var(--ink)] font-medium">eCommerce latency:</strong> Sub-second cloud execution suitable for active shopping sessions and mobile checkout.</li>
              </ul>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="mt-14 flex flex-wrap items-center justify-between gap-6 border-t border-[var(--line)] pt-8">
            <p className="max-w-xl text-sm leading-relaxed text-[var(--ink-2)]">
              Try-on is a visual guide. Explore our calibration benchmarks or try a piece on your own photo.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/how-it-works"
                className="inline-flex min-h-[52px] items-center border border-[var(--line)] bg-[var(--paper)] px-6 text-sm text-[var(--ink)] hover:border-[var(--gold)] transition-colors"
              >
                How sizing works
              </Link>
              <Link
                href="/try-on/gilded-teardrop?sample=1"
                className="inline-flex min-h-[52px] items-center bg-[var(--ink)] px-8 text-base text-[var(--paper)] hover:bg-[var(--gold)] hover:text-white transition-colors"
              >
                Try a sample
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
