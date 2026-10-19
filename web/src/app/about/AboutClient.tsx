'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { PillButton } from '@/components/PillButton'
import { BoxRevealHeading } from '@/components/BoxReveal'
import { MacroTilt } from '@/components/MacroTilt'
import { Glint } from '@/components/Glint'

const SIZE_OPTIONS = [2.0, 3.0, 4.5, 6.0]

export function AboutClient() {
  // Simulator State
  const [irisPx, setIrisPx] = useState(37)
  const [requestedCm, setRequestedCm] = useState(3.0)

  // Optical Calculations (matching web/src/lib/size.ts)
  const mmPerPx = 11.7 / irisPx
  const pxPerCm = irisPx / 1.17
  const renderedPx = Math.round(requestedCm * pxPerCm)
  const renderedCm = Number((renderedPx / pxPerCm).toFixed(2))
  const errorPct = Number((((renderedCm - requestedCm) / requestedCm) * 100).toFixed(2))
  const withinTolerance = Math.abs(errorPct) <= 10.0

  return (
    <main className="min-h-screen pt-36 pb-24 px-8 max-w-7xl mx-auto">
      {/* Standard Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 ui-label text-[11px] text-[var(--ink-2)]">
          <li>
            <Link
              href="/"
              className="hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] transition-colors"
            >
              HOME
            </Link>
          </li>
          <li aria-hidden="true" className="text-[var(--line)]">
            /
          </li>
          <li className="text-[var(--ink)]">ABOUT</li>
        </ol>
      </nav>

      {/* Section 1: Hero & Editorial Manifesto */}
      <section className="mb-20">
        <span className="ui-label text-[var(--gold)] block mb-3">Technology & Craft</span>
        <BoxRevealHeading as="h1" className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-[var(--ink)] mb-6">
          About <span className="font-serif-italic">Darpan</span>
        </BoxRevealHeading>

        <p className="text-lg sm:text-xl text-[var(--ink)] max-w-3xl leading-relaxed mb-4 font-light">
          Darpan means mirror. It solves the biggest issue in online jewellery shopping: knowing how large a piece will look on your face before you buy.
        </p>

        <p className="text-sm sm:text-base text-[var(--ink-2)] max-w-3xl leading-relaxed mb-8 font-normal">
          Online shoppers frequently return earrings and necklaces because product photography cannot convey how a 4.5 cm chandelier drop or 2.0 cm huggie will scale relative to individual jawline, neck, and ear geometry. Darpan pairs ophthalmic optical measurement with zero photo retention privacy and CyberLink YouCam cloud pipelines to deliver true physical scale fidelity.
        </p>

        {/* Feature Badges with Glint */}
        <div className="flex flex-wrap items-center gap-3">
          <Glint>
            <span className="ui-label text-[10px] bg-white dark:bg-black/40 border border-[var(--gold)]/40 px-3 py-1.5 rounded-full text-[var(--gold)] tracking-wider">
              11.7 MM ANATOMICAL CONSTANT
            </span>
          </Glint>
          <Glint>
            <span className="ui-label text-[10px] bg-white dark:bg-black/40 border border-[var(--gold)]/40 px-3 py-1.5 rounded-full text-[var(--gold)] tracking-wider">
              ±10% TOLERANCE GUARANTEED
            </span>
          </Glint>
          <Glint>
            <span className="ui-label text-[10px] bg-white dark:bg-black/40 border border-[var(--gold)]/40 px-3 py-1.5 rounded-full text-[var(--gold)] tracking-wider">
              ZERO PHOTO RETENTION
            </span>
          </Glint>
          <Glint>
            <span className="ui-label text-[10px] bg-white dark:bg-black/40 border border-[var(--gold)]/40 px-3 py-1.5 rounded-full text-[var(--gold)] tracking-wider">
              0-UNIT SAMPLE CACHE
            </span>
          </Glint>
        </div>
      </section>

      {/* Section 2: Interactive Iris Calibration Simulator */}
      <section className="mb-20">
        <MacroTilt maxTiltDeg={4}>
          <div className="p-8 sm:p-10 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <span className="ui-label text-[var(--gold)]">Optical Science</span>
              <span className="ui-label text-[10px] text-[var(--ink-2)] font-mono">
                pxPerCm = irisPx / 1.17
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-light text-[var(--ink)] mb-4">
              How true-size measurement works
            </h2>

            <p className="text-sm sm:text-base text-[var(--ink-2)] leading-relaxed mb-8 max-w-3xl">
              Human visible iris diameter has a remarkably constant average across populations: 11.7 mm (±0.5 mm). By measuring the iris pixel diameter in your photo, Darpan calculates the exact pixel-to-millimetre scale ratio. Earring heights are rendered to match this scale, with measurement verification confirming accuracy within ±10%.
            </p>

            {/* Interactive Caliper Controls & Live Readouts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-4 border-t border-[var(--line)]">
              {/* Controls Column */}
              <div className="lg:col-span-6 space-y-6">
                {/* Iris Pixel Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="iris-slider" className="ui-label text-xs text-[var(--ink)] font-medium">
                      Iris Diameter in Photo (pixels)
                    </label>
                    <span className="font-mono text-xs font-semibold text-[var(--gold)]">
                      {irisPx} px
                    </span>
                  </div>
                  <input
                    id="iris-slider"
                    type="range"
                    min={25}
                    max={50}
                    step={1}
                    value={irisPx}
                    onChange={(e) => setIrisPx(Number(e.target.value))}
                    aria-label="Iris diameter in pixels"
                    className="w-full accent-[var(--gold)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--ink-2)] mt-1 font-mono">
                    <span>25 px (wide shot)</span>
                    <span className="text-[var(--gold)] font-bold">37 px (studio standard)</span>
                    <span>50 px (close portrait)</span>
                  </div>
                </div>

                {/* Earring Size Selector Chips */}
                <div>
                  <span className="ui-label text-xs text-[var(--ink)] block mb-2 font-medium">
                    Requested Earring Physical Height (cm)
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {SIZE_OPTIONS.map((size) => {
                      const isSelected = requestedCm === size
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setRequestedCm(size)}
                          className={`py-2 px-3 text-xs font-mono rounded-[var(--radius-sm)] border transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] ${
                            isSelected
                              ? 'border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--ink)] font-bold ring-1 ring-[var(--gold)]'
                              : 'border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink)] bg-white/40 dark:bg-black/20'
                          }`}
                        >
                          {`${size.toFixed(1)} cm`}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Live Mathematical Readout Table */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-[var(--radius-sm)] bg-white/60 dark:bg-black/30 border border-[var(--line)]">
                  <div>
                    <span className="ui-label text-[9px] text-[var(--ink-2)] block">SCALE RATIO</span>
                    <span className="font-mono text-sm font-semibold text-[var(--ink)]">
                      {mmPerPx.toFixed(3)} mm/px
                    </span>
                  </div>
                  <div>
                    <span className="ui-label text-[9px] text-[var(--ink-2)] block">PIXEL DENSITY</span>
                    <span className="font-mono text-sm font-semibold text-[var(--ink)]">
                      {pxPerCm.toFixed(1)} px/cm
                    </span>
                  </div>
                  <div>
                    <span className="ui-label text-[9px] text-[var(--ink-2)] block">RENDER HEIGHT</span>
                    <span className="font-mono text-sm font-semibold text-[var(--gold)]">
                      {renderedPx} px
                    </span>
                  </div>
                </div>

                {/* Tolerance Status Chip */}
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--gold)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
                  <span>
                    {withinTolerance
                      ? 'Measurement verification confirming accuracy within ±10%'
                      : 'Scale exceeds ±10% threshold'}
                  </span>
                </div>
              </div>

              {/* Dynamic SVG Visual Caliper Column */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 bg-white/30 dark:bg-black/20 rounded-[var(--radius-sm)] border border-[var(--line)]">
                <svg
                  viewBox="0 0 360 220"
                  className="w-full h-auto max-w-sm"
                  aria-label="Iris optical measurement and earring drop scale diagram"
                >
                  {/* Eye outline */}
                  <path
                    d="M 40 110 C 90 60, 190 60, 240 110 C 190 160, 90 160, 40 110 Z"
                    fill="var(--paper)"
                    stroke="var(--line)"
                    strokeWidth="1.5"
                  />
                  {/* Iris */}
                  <circle
                    cx="140"
                    cy="110"
                    r={Math.min(48, Math.max(24, (irisPx / 37) * 32))}
                    fill="var(--ink)"
                    opacity="0.88"
                  />
                  {/* Pupil */}
                  <circle
                    cx="140"
                    cy="110"
                    r={Math.min(20, Math.max(10, (irisPx / 37) * 14))}
                    fill="#151412"
                  />
                  {/* Corneal reflection highlight */}
                  <circle cx="132" cy="102" r="4" fill="#FFFFFF" opacity="0.9" />

                  {/* Caliper dashed guides */}
                  <line
                    x1={140 - (irisPx / 37) * 32}
                    y1="50"
                    x2={140 - (irisPx / 37) * 32}
                    y2="170"
                    stroke="var(--gold)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={140 + (irisPx / 37) * 32}
                    y1="50"
                    x2={140 + (irisPx / 37) * 32}
                    y2="170"
                    stroke="var(--gold)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />

                  {/* Caliper measurement bar */}
                  <line
                    x1={140 - (irisPx / 37) * 32}
                    y1="58"
                    x2={140 + (irisPx / 37) * 32}
                    y2="58"
                    stroke="var(--gold)"
                    strokeWidth="2"
                  />
                  <circle cx={140 - (irisPx / 37) * 32} cy="58" r="3" fill="var(--gold)" />
                  <circle cx={140 + (irisPx / 37) * 32} cy="58" r="3" fill="var(--gold)" />
                  <text
                    x="140"
                    y="48"
                    textAnchor="middle"
                    fill="var(--gold)"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    11.7 mm ({irisPx}px)
                  </text>

                  {/* Earring Drop Caliper on Right */}
                  <g transform="translate(290, 30)">
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2={Math.min(160, Math.max(30, renderedPx * 0.75))}
                      stroke="var(--gold)"
                      strokeWidth="2"
                    />
                    <line x1="-6" y1="0" x2="6" y2="0" stroke="var(--gold)" strokeWidth="2" />
                    <line
                      x1="-6"
                      y1={Math.min(160, Math.max(30, renderedPx * 0.75))}
                      x2="6"
                      y2={Math.min(160, Math.max(30, renderedPx * 0.75))}
                      stroke="var(--gold)"
                      strokeWidth="2"
                    />
                    {/* Earring Silhouette */}
                    <path
                      d={`M 0 5 Q 10 ${Math.min(80, renderedPx * 0.4)} 0 ${Math.min(
                        150,
                        renderedPx * 0.7
                      )} Q -10 ${Math.min(80, renderedPx * 0.4)} 0 5 Z`}
                      fill="var(--gold)"
                      opacity="0.35"
                    />
                    <text
                      x="14"
                      y={Math.min(80, renderedPx * 0.38)}
                      fill="var(--ink)"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {requestedCm.toFixed(1)} cm
                    </text>
                    <text
                      x="14"
                      y={Math.min(80, renderedPx * 0.38) + 14}
                      fill="var(--ink-2)"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      ({renderedPx} px)
                    </text>
                  </g>
                </svg>

                <span className="ui-label text-[10px] text-[var(--ink-2)] mt-3">
                  Live mathematical projection: HVID = 11.7 mm anatomical baseline
                </span>
              </div>
            </div>
          </div>
        </MacroTilt>
      </section>

      {/* Section 3: Zero Photo Retention & Privacy Guarantee */}
      <section className="mb-20">
        <span className="ui-label text-[var(--gold)] block mb-3">Privacy & Trust</span>
        <h2 className="text-2xl sm:text-3xl font-light text-[var(--ink)] mb-4">
          Photo safety and zero retention
        </h2>
        <p className="text-sm sm:text-base text-[var(--ink-2)] max-w-3xl leading-relaxed mb-10">
          Photos are processed exclusively for your session try-on pipeline with zero retention. Uploaded portraits are ingested into memory, stripped of location and device metadata, and destroyed automatically upon session completion.
        </p>

        {/* 3-Step Lifecycle Visual Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] flex flex-col justify-between">
            <div>
              <span className="ui-label text-[10px] text-[var(--gold)] block mb-2">01 / NORMALIZATION</span>
              <h3 className="text-lg font-medium text-[var(--ink)] mb-3">Local Ingestion & EXIF Stripping</h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Images are read into volatile server memory via Sharp. EXIF orientation is applied, camera serials, timestamps, and GPS coordinates are irreversibly stripped, and the long side is capped at ≤ 2048px without upscaling.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--line)] font-mono text-[10px] text-[var(--ink-2)]">
              Raw PNG in-memory stream
            </div>
          </div>

          <div className="p-6 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] flex flex-col justify-between">
            <div>
              <span className="ui-label text-[10px] text-[var(--gold)] block mb-2">02 / CRYPTOGRAPHY</span>
              <h3 className="text-lg font-medium text-[var(--ink)] mb-3">Cryptographic Hashing</h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                A SHA-256 fingerprint is computed from the normalised image buffer for session cache deduplication. Zero facial landmarks, biometric templates, 3D meshes, or vector embeddings are persisted.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--line)] font-mono text-[10px] text-[var(--ink-2)]">
              photoHash = sha256(pngBuffer)
            </div>
          </div>

          <div className="p-6 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] flex flex-col justify-between">
            <div>
              <span className="ui-label text-[10px] text-[var(--gold)] block mb-2">03 / DESTRUCTION</span>
              <h3 className="text-lg font-medium text-[var(--ink)] mb-3">Ephemeral Destruction</h3>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Temporary files written to ephemeral scratch storage automatically expire and are purged. Images are never linked to personal identities, never retained in persistent databases, and strictly prohibited from AI model training.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--line)] font-mono text-[10px] text-[var(--ink-2)]">
              Session destruction guaranteed
            </div>
          </div>
        </div>

        {/* Privacy Comparison Table */}
        <div className="rounded-[var(--radius-sm)] border border-[var(--line)] overflow-hidden bg-[var(--paper)]">
          <div className="px-6 py-4 bg-white/40 dark:bg-black/20 border-b border-[var(--line)]">
            <span className="ui-label text-xs text-[var(--ink)] font-medium">
              Architectural Privacy Comparison
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--line)] bg-white/20 dark:bg-black/10">
                  <th className="py-3 px-6 ui-label text-[10px] text-[var(--ink-2)]">DIMENSION</th>
                  <th className="py-3 px-6 ui-label text-[10px] text-[var(--ink-2)]">CONVENTIONAL TRY-ON</th>
                  <th className="py-3 px-6 ui-label text-[10px] text-[var(--gold)]">DARPAN ARCHITECTURE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[var(--ink)]">Facial Recognition</td>
                  <td className="py-3.5 px-6 text-[var(--ink-2)]">Persistent face-mesh & biometric embedding storage</td>
                  <td className="py-3.5 px-6 font-medium text-[var(--ink)]">Zero biometric templates; iris calipers are computed ephemeral metrics</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[var(--ink)]">Metadata & GPS</td>
                  <td className="py-3.5 px-6 text-[var(--ink-2)]">EXIF GPS, camera serials, device fingerprints stored</td>
                  <td className="py-3.5 px-6 font-medium text-[var(--ink)]">EXIF stripped automatically via Sharp in-memory pipeline</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[var(--ink)]">Data Retention</td>
                  <td className="py-3.5 px-6 text-[var(--ink-2)]">Indefinite user media storage in cloud buckets</td>
                  <td className="py-3.5 px-6 font-medium text-[var(--ink)]">Ephemeral session scratch storage with automatic expiration</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[var(--ink)]">User Identification</td>
                  <td className="py-3.5 px-6 text-[var(--ink-2)]">Photos tied to phone, email, IP, and tracking cookies</td>
                  <td className="py-3.5 px-6 font-medium text-[var(--ink)]">Strictly anonymous SHA-256 hashes; zero personal data linkage</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[var(--ink)]">AI Model Training</td>
                  <td className="py-3.5 px-6 text-[var(--ink-2)]">User selfies ingested to train commercial neural nets</td>
                  <td className="py-3.5 px-6 font-medium text-[var(--ink)]">Strict prohibition; user photos are never used for model training</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 4: CyberLink YouCam API Integration & Unit Economics */}
      <section className="mb-20">
        <span className="ui-label text-[var(--gold)] block mb-3">API Integration</span>
        <h2 className="text-2xl sm:text-3xl font-light text-[var(--ink)] mb-4">
          CyberLink YouCam API integration & unit economics
        </h2>
        <p className="text-sm sm:text-base text-[var(--ink-2)] max-w-3xl leading-relaxed mb-8">
          Darpan orchestrates enterprise CyberLink YouCam cloud neural networks for true-to-life jewellery and styling synthesis, protected by rate-limiting guardrails and deterministic 0-unit sample face caching.
        </p>

        {/* API Endpoint Transparency Table */}
        <div className="rounded-[var(--radius-sm)] border border-[var(--line)] overflow-hidden bg-[var(--paper)] mb-10">
          <div className="px-6 py-4 bg-white/40 dark:bg-black/20 border-b border-[var(--line)]">
            <span className="ui-label text-xs text-[var(--ink)] font-medium">
              Enterprise CyberLink YouCam Endpoint Matrix
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--line)] bg-white/20 dark:bg-black/10">
                  <th className="py-3 px-6 ui-label text-[10px] text-[var(--ink-2)]">SERVICE</th>
                  <th className="py-3 px-6 ui-label text-[10px] text-[var(--ink-2)]">YOUCAM API ROUTE</th>
                  <th className="py-3 px-6 ui-label text-[10px] text-[var(--gold)]">UNIT COST</th>
                  <th className="py-3 px-6 ui-label text-[10px] text-[var(--ink-2)]">PIPELINE FUNCTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                <tr>
                  <td className="py-3 px-6 font-medium text-[var(--ink)]">2D VTO Earring</td>
                  <td className="py-3 px-6 font-mono text-[var(--ink-2)]">/s2s/v2.0/task/2d-vto/earring</td>
                  <td className="py-3 px-6 font-mono font-semibold text-[var(--gold)]">1 unit</td>
                  <td className="py-3 px-6 text-[var(--ink-2)]">True physical earring scale ($H_&#123;\text&#123;cm&#125;&#125;$), right/left earlobe alignment</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-medium text-[var(--ink)]">Earring Stack</td>
                  <td className="py-3 px-6 font-mono text-[var(--ink-2)]">/s2s/v2.0/task/2d-vto/earring</td>
                  <td className="py-3 px-6 font-mono font-semibold text-[var(--gold)]">2 units</td>
                  <td className="py-3 px-6 text-[var(--ink-2)]">Multi-piercing placement (lobe, upper lobe, helix) with vertical gap validation</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-medium text-[var(--ink)]">2D VTO Necklace</td>
                  <td className="py-3 px-6 font-mono text-[var(--ink-2)]">/s2s/v2.0/task/2d-vto/necklace</td>
                  <td className="py-3 px-6 font-mono font-semibold text-[var(--gold)]">1 unit</td>
                  <td className="py-3 px-6 text-[var(--ink-2)]">Collarbone and neckline jewellery draping</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-medium text-[var(--ink)]">Makeup VTO</td>
                  <td className="py-3 px-6 font-mono text-[var(--ink-2)]">/s2s/v2.0/task/makeup-vto</td>
                  <td className="py-3 px-6 font-mono font-semibold text-[var(--gold)]">1 unit</td>
                  <td className="py-3 px-6 text-[var(--ink-2)]">Harmonized lipstick palettes (matte/satin) matching Indian skin undertones</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-medium text-[var(--ink)]">Hair Transfer</td>
                  <td className="py-3 px-6 font-mono text-[var(--ink-2)]">/s2s/v2.1/task/hair-transfer</td>
                  <td className="py-3 px-6 font-mono font-semibold text-[var(--gold)]">2 units</td>
                  <td className="py-3 px-6 text-[var(--ink-2)]">Tied updo clearing hair from ears while preserving natural hair color</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-medium text-[var(--ink)]">Cloth V4</td>
                  <td className="py-3 px-6 font-mono text-[var(--ink-2)]">/s2s/v2.0/task/cloth-v4</td>
                  <td className="py-3 px-6 font-mono font-semibold text-[var(--gold)]">2 units</td>
                  <td className="py-3 px-6 text-[var(--ink-2)]">High-fashion festive blouse styling pairing metal tone with fabric zari</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Anatomical Pipeline Sequencing & Credit Preservation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)]">
            <span className="ui-label text-[10px] text-[var(--gold)] block mb-2">ANATOMICAL PIPELINE</span>
            <h3 className="text-lg font-medium text-[var(--ink)] mb-3">Multi-Stage Execution Order</h3>
            <p className="text-xs text-[var(--ink-2)] leading-relaxed mb-4">
              When styling presets are toggled, jobs execute strictly in anatomical order:
            </p>
            <div className="p-3 bg-white/50 dark:bg-black/30 rounded border border-[var(--line)] font-mono text-xs text-[var(--gold)] mb-4">
              OUTFIT (Cloth, 2u) → HAIR (Hair Transfer, 2u) → LIPSTICK (Makeup, 1u) → EARRING / NECKLACE (1u)
            </div>
            <p className="text-xs text-[var(--ink-2)] leading-relaxed">
              This sequence guarantees hair is swept up before earrings are positioned, and lipstick is applied without distorting fine metallic reflections or stone facets.
            </p>
          </div>

          <div className="p-6 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)]">
            <span className="ui-label text-[10px] text-[var(--gold)] block mb-2">CREDIT PRESERVATION</span>
            <h3 className="text-lg font-medium text-[var(--ink)] mb-3">Zero-Unit Sample Face Architecture</h3>
            <p className="text-xs text-[var(--ink-2)] leading-relaxed mb-4">
              To provide instantaneous demonstrations without consuming paid API quotas:
            </p>
            <ul className="text-xs text-[var(--ink-2)] space-y-2 leading-relaxed">
              <li>
                • <strong>Deterministic Caching:</strong> Pre-calibrated studio face (photoId: <code className="font-mono text-[10px]">f813b082...</code>, iris: 37px) resolves instantly from content-addressable step cache at 0 units spent.
              </li>
              <li>
                • <strong>Rate Guardrails:</strong> System enforces a 20-unit reserve floor, 15-unit daily visitor cap, and automated HTTP 429 exponential backoff retries.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 5: Editorial Call-to-Action Bar */}
      <section className="p-8 sm:p-12 rounded-[var(--radius-sm)] border border-[var(--line)] bg-gradient-to-br from-[var(--paper)] via-[var(--paper)] to-[var(--gold)]/5 text-center">
        <span className="ui-label text-[var(--gold)] block mb-3">Experience Darpan</span>
        <h2 className="text-2xl sm:text-4xl font-light text-[var(--ink)] mb-4">
          See the difference true physical scale makes
        </h2>
        <p className="text-sm sm:text-base text-[var(--ink-2)] max-w-xl mx-auto leading-relaxed mb-8">
          Experience our iris-calibrated try-on with studio sample faces or your own portrait, or explore color harmony recommendations with our virtual stylist.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <PillButton href="/p/gilded-teardrop?tryon=1" variant="primary">
            TRY ON ME
          </PillButton>
          <PillButton href="/stylist" variant="secondary">
            VIRTUAL STYLIST
          </PillButton>
          <PillButton href="/" variant="secondary">
            EXPLORE PIECES
          </PillButton>
        </div>
      </section>
    </main>
  )
}
