'use client'

import React, { useState } from 'react'
import Link from 'next/link'

interface ComparisonRow {
  dimension: string
  youcamAdvantage: string
  genericLlmFlaw: string
}

const COMPARISON_DATA: ComparisonRow[] = [
  {
    dimension: 'Scale & physical proportions',
    youcamAdvantage:
      'Sub-millimeter biological calibration anchored to the 11.7 mm iris, sternal notch, and wrist width. True 1:1 physical millimeter rendering.',
    genericLlmFlaw:
      'Arbitrary pixel scaling without spatial grounding. A 3 cm earring may render at 8 cm or shrink to a pinhead depending on random seed.',
  },
  {
    dimension: 'Facial identity & natural skin',
    youcamAdvantage:
      '100% customer likeness preserved. Zero face-morphing. Natural skin pores, authentic bone structure, and ambient lighting remain untouched.',
    genericLlmFlaw:
      'Regenerates or smooths facial features through diffusion inpainting, altering facial symmetry and creating an uncanny valley effect.',
  },
  {
    dimension: 'SKU & inventory fidelity',
    youcamAdvantage:
      'Renders the exact catalog item with authentic metal luster, gemstone facets, and physical drop physics from retailer inventory.',
    genericLlmFlaw:
      'Hallucinates fictional decorative pieces that do not exist in inventory, leading to customer dissatisfaction and product returns.',
  },
  {
    dimension: 'Earlobe & hair occlusion',
    youcamAdvantage:
      'Specialized hairstyle simulation lifts hair into tied styles (braids, buns, updos) to uncover the earlobe and neck before earring try-on.',
    genericLlmFlaw:
      'Lacks 3D occlusion understanding; overlays earrings on top of hair strands or paints them across the jawline.',
  },
  {
    dimension: 'Complexion & tone harmonization',
    youcamAdvantage:
      'Cosmetic lipstick simulation applies genuine cosmetic shades across the vermilion border to preview harmonious jewelry and beauty tones.',
    genericLlmFlaw:
      'Over-saturates image colors and shifts background temperature unpredictably, unable to reproduce specific cosmetic shade codes.',
  },
  {
    dimension: 'eCommerce response time',
    youcamAdvantage:
      'Sub-second to 2-second cloud inference designed for high-conversion eCommerce checkout funnels and mobile shoppers.',
    genericLlmFlaw:
      'Heavy diffusion generations take 20 to 45 seconds per image with substantial compute costs, causing checkout drop-offs.',
  },
]

const YOUCAM_ENDPOINTS = [
  {
    id: 'hair-styling',
    name: 'Hair Styling Simulation',
    method: 'POST /v1/hair/styling',
    category: 'Hairstyle modification',
    summary:
      'Adjusts hair into tied-up styles (braids, buns, updos) to expose the earlobe and neckline prior to earring placement.',
    benchmark: 'Earlobe exposure',
  },
  {
    id: 'makeup-transfer',
    name: 'Cosmetic Tone Harmonization',
    method: 'POST /v1/makeup/lip',
    category: 'Lipstick shade mapping',
    summary:
      'Applies cosmetic shades with authentic finishes (matte, gloss, shimmer) across the vermilion border to harmonize with jewellery metal tones.',
    benchmark: 'Vermilion border mapping',
  },
  {
    id: 'facial-landmarks',
    name: 'Biometric Landmark Tracking',
    method: 'YouCam Core AR SDK',
    category: 'Photogrammetric anchors',
    summary:
      'Tracks iris boundary (11.7 mm average), tragus-to-lobule axis, and sternal notch to compute true physical scale ratios.',
    benchmark: '0.1 mm measurement precision',
  },
  {
    id: 'hybrid-agentic',
    name: 'Agentic Concierge Integration',
    method: 'YouCam + Inventory Database',
    category: 'Hybrid workflow',
    summary:
      'Combines deterministic computer vision physics from YouCam with conversational inventory reasoning for live customer assistance.',
    benchmark: 'Zero hallucinated SKUs',
  },
]

export function YouCamAdvantageSection() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'architecture' | 'endpoints'>('matrix')

  return (
    <section
      id="youcam-advantage"
      className="scroll-mt-[calc(var(--header-h)+2rem)] my-12"
      aria-labelledby="youcam-advantage-title"
    >
      <div className="border border-[var(--line)] bg-[var(--paper)] p-6 sm:p-10 lg:p-12">
        {/* Section Header */}
        <div className="max-w-3xl">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--gold)]">
            Technology reference · Perfect Corp YouCam API
          </p>

          <h2
            id="youcam-advantage-title"
            className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl text-[var(--ink)] tracking-tight"
          >
            Why specialized computer vision matters for virtual try-on.
          </h2>

          <p className="mt-4 text-base text-[var(--ink-2)] leading-relaxed">
            Generic language models and text-to-image diffusion tools generate speculative pixels rather than true physical measurements. 
            Darpan integrates Perfect Corp’s YouCam API to deliver deterministic landmark tracking, authentic identity preservation, and production retail accuracy.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="mt-8 flex flex-wrap gap-2 border-b border-[var(--line)] pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-[var(--ink)] text-[var(--paper)]'
                : 'bg-[var(--bg)] text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            Comparison matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-[var(--ink)] text-[var(--paper)]'
                : 'bg-[var(--bg)] text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            Hybrid architecture
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('endpoints')}
            className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'endpoints'
                ? 'bg-[var(--ink)] text-[var(--paper)]'
                : 'bg-[var(--bg)] text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            API integrations
          </button>
        </div>

        {/* TAB 1: Comparison Matrix */}
        {activeTab === 'matrix' && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs font-medium uppercase tracking-wider text-[var(--ink)]">
                  <th className="py-3 pr-6 w-1/4">Evaluation dimension</th>
                  <th className="py-3 px-6 w-3/8 text-[var(--ink)] bg-[var(--bg)]">
                    YouCam API in Darpan
                  </th>
                  <th className="py-3 pl-6 w-3/8 text-[var(--ink-2)]">
                    Generic LLMs & diffusion
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] text-[var(--ink-2)]">
                {COMPARISON_DATA.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[var(--bg)]/40 transition-colors">
                    <td className="py-4 pr-6 font-medium text-[var(--ink)] align-top">
                      {row.dimension}
                    </td>
                    <td className="py-4 px-6 bg-[var(--bg)]/60 text-[var(--ink)] align-top leading-relaxed">
                      {row.youcamAdvantage}
                    </td>
                    <td className="py-4 pl-6 align-top leading-relaxed">
                      {row.genericLlmFlaw}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: Hybrid Architecture */}
        {activeTab === 'architecture' && (
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="border border-[var(--line)] bg-[var(--bg)] p-6 space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--gold)]">Pillar 01</span>
              <h3 className="font-display text-xl text-[var(--ink)]">Deterministic computer vision</h3>
              <p className="text-sm text-[var(--ink-2)] leading-relaxed">
                YouCam neural face-parsing isolates the iris limbus (11.7 mm biological reference), earlobe contours, and lip boundaries with repeatable physical precision.
              </p>
              <p className="pt-2 text-xs font-mono text-[var(--ink-2)]">Engine: Perfect Corp AR SDK</p>
            </div>

            <div className="border border-[var(--line)] bg-[var(--bg)] p-6 space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--gold)]">Pillar 02</span>
              <h3 className="font-display text-xl text-[var(--ink)]">Physical scale calibration</h3>
              <p className="text-sm text-[var(--ink-2)] leading-relaxed">
                Darpan translates landmark vectors into real-world coordinates: catenary neck drape curves (40 to 50 cm), 60 mm wrist anchors, and standard US ring gauges.
              </p>
              <p className="pt-2 text-xs font-mono text-[var(--ink-2)]">Precision: 0.1 mm margin</p>
            </div>

            <div className="border border-[var(--line)] bg-[var(--bg)] p-6 space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--gold)]">Pillar 03</span>
              <h3 className="font-display text-xl text-[var(--ink)]">Conversational stylist concierge</h3>
              <p className="text-sm text-[var(--ink-2)] leading-relaxed">
                The conversational concierge queries live catalog inventory, suggests matching metal tones, and requests hairstyle and lipstick adjustments without hallucinating fake products.
              </p>
              <p className="pt-2 text-xs font-mono text-[var(--ink-2)]">Workflow: Catalog RAG + YouCam AR</p>
            </div>
          </div>
        )}

        {/* TAB 3: API Integrations */}
        {activeTab === 'endpoints' && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {YOUCAM_ENDPOINTS.map((endpoint) => (
              <div
                key={endpoint.id}
                className="border border-[var(--line)] bg-[var(--bg)] p-6 space-y-3"
              >
                <div className="flex items-center justify-between text-xs font-mono text-[var(--ink-2)]">
                  <span>{endpoint.category}</span>
                  <span>{endpoint.benchmark}</span>
                </div>
                <h4 className="font-display text-lg text-[var(--ink)]">{endpoint.name}</h4>
                <code className="inline-block text-xs font-mono text-[var(--gold)]">
                  {endpoint.method}
                </code>
                <p className="text-sm text-[var(--ink-2)] leading-relaxed">
                  {endpoint.summary}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Action Row */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-8">
          <p className="text-sm text-[var(--ink-2)]">
            Explore live try-on with hairstyle simulation and lipstick harmonization.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/try-on/gilded-teardrop?sample=1&style=1"
              className="inline-flex min-h-[44px] items-center bg-[var(--ink)] px-6 text-sm text-[var(--paper)] hover:bg-[var(--gold)] hover:text-white transition-colors"
            >
              Try on with style features
            </Link>

            <Link
              href="/how-it-works"
              className="inline-flex min-h-[44px] items-center border border-[var(--line)] bg-[var(--bg)] px-6 text-sm text-[var(--ink)] hover:border-[var(--gold)] transition-colors"
            >
              How sizing works
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
