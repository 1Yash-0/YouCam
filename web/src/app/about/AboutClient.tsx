'use client'

import React, { useState } from 'react'
import Link from 'next/link'

const SIZE_OPTIONS = [2.0, 3.0, 4.5, 6.0]


export function AboutClient() {
  const [requestedCm, setRequestedCm] = useState(3.0)

  return (
    <>
      <style>{`
        .about-page {
          --about-ground: var(--bg);
          --about-surface: var(--paper);
          --about-ink: var(--ink);
          --about-accent: var(--gold);
          width: min(1120px, calc(100% - 48px));
          margin: 0 auto;
          padding: 112px 0 96px;
          color: var(--about-ink);
          background: var(--about-ground);
        }
        .about-page * { box-sizing: border-box; }
        .about-page a { color: inherit; }
        .about-page p,
        .about-page li,
        .about-page figcaption { max-width: 62ch; }
        .about-page p,
        .about-page li { font-size: 17px; line-height: 1.6; }
        .about-page h1,
        .about-page h2 { font-family: var(--font-display); font-weight: 400; letter-spacing: -0.035em; }
        .about-page h1 {
          max-width: 7ch;
          margin: 0;
          font-size: clamp(3.75rem, 8vw, 6rem);
          line-height: 0.92;
        }
        .about-page h2 {
          max-width: 17ch;
          margin: 0 0 24px;
          font-size: clamp(2.25rem, 4.8vw, 3.5rem);
          line-height: 0.98;
        }
        .about-page .about-lead {
          margin: 0;
          font-size: 1.25rem;
          line-height: 1.42;
        }
        .about-page .about-caption {
          margin: 12px 0 0;
          font-size: 16px;
          line-height: 1.5;
        }
        .about-nav {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 80px;
          font-size: 16px;
          line-height: 1.4;
        }
        .about-intro {
          display: grid;
          grid-template-columns: minmax(220px, 0.78fr) minmax(0, 1.22fr);
          gap: clamp(40px, 8vw, 128px);
          align-items: start;
          padding-bottom: 144px;
        }
        .about-intro-copy { padding-top: 8px; }
        .about-intro-copy > p + p { margin-top: 24px; }
        .about-facts {
          display: grid;
          gap: 14px;
          margin: 40px 0 0;
          padding: 28px 0 0 28px;
          list-style: none;
          background: var(--about-surface);
        }
        .about-facts li { margin: 0; padding-right: 20px; }
        .about-section { margin-top: 144px; }
        .about-section > p { margin: 0 0 36px; }
        .about-size-pair {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-top: 52px;
        }
        .about-figure { margin: 0; min-width: 0; }
        .about-image {
          display: block;
          width: 100%;
          height: auto;
          aspect-ratio: 4 / 3;
          object-fit: contain;
          background: var(--about-surface);
        }
        .about-measure-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(260px, 1.05fr);
          gap: clamp(32px, 7vw, 96px);
          align-items: start;
        }
        .about-face-image { aspect-ratio: 1 / 1; }
        .about-measure-note {
          margin: 0;
          padding: 32px;
          background: var(--about-surface);
        }
        .about-measure-note p { margin: 0; }
        .about-control {
          margin-top: 34px;
          padding-top: 26px;
          background: var(--about-ground);
        }
        .about-control p { margin: 0 0 16px; }
        .about-range {
          display: block;
          width: 100%;
          margin: 20px 0 26px;
          accent-color: var(--about-accent);
          cursor: pointer;
        }
        .about-size-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .about-size-option {
          min-width: 72px;
          min-height: 52px;
          padding: 0 18px;
          border: 0;
          border-radius: 0;
          background: var(--about-surface);
          color: var(--about-ink);
          font: inherit;
          font-size: 16px;
          line-height: 1.3;
          cursor: pointer;
        }
        .about-size-option:hover { opacity: 0.86; }
        .about-size-option[aria-pressed='true'] { background: var(--about-ink); color: var(--about-surface); }
        .about-measure-result { margin-top: 24px !important; }
        .about-privacy-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(220px, 0.85fr);
          gap: clamp(32px, 8vw, 128px);
          align-items: start;
        }
        .about-privacy-facts {
          margin: 0;
          padding: 28px;
          list-style: none;
          background: var(--about-surface);
        }
        .about-privacy-facts li + li { margin-top: 22px; }
        .about-api-copy { max-width: 62ch; }
        .about-api-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 30px 56px;
          margin: 50px 0 0;
          padding: 0;
          list-style: none;
        }
        .about-api-list li { margin: 0; }
        .about-api-list strong { display: block; margin-bottom: 8px; }
        .about-cta {
          margin-top: 160px;
          padding: 56px clamp(24px, 7vw, 88px);
          background: var(--about-surface);
          text-align: center;
        }
        .about-cta h2 { max-width: 15ch; margin: 0 auto 22px; }
        .about-cta p { margin: 0 auto 32px; }
        .about-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 20px;
        }
        .about-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 52px;
          padding: 0 28px;
          background: var(--about-ink);
          color: var(--about-surface) !important;
          font-size: 16px;
          line-height: 1;
          text-decoration: none;
          transition: opacity 180ms var(--ease-out);
        }
        .about-action:hover { opacity: 0.86; }
        .about-page .about-credits {
          max-width: 62ch;
          margin: 56px 0 0;
          font-size: 16px;
          line-height: 1.6;
          color: var(--ink-2);
        }
        @media (max-width: 720px) {
          .about-page { width: min(100% - 32px, 560px); padding-top: 76px; }
          .about-nav { margin-bottom: 56px; }
          .about-intro,
          .about-measure-grid,
          .about-privacy-grid { grid-template-columns: 1fr; gap: 36px; }
          .about-intro { padding-bottom: 88px; }
          .about-intro-copy { padding-top: 0; }
          .about-section { margin-top: 88px; }
          .about-size-pair { gap: 10px; margin-top: 36px; }
          .about-caption { overflow-wrap: anywhere; }
          .about-measure-note { padding: 24px; }
          .about-api-list { grid-template-columns: 1fr; gap: 24px; margin-top: 36px; }
          .about-cta { margin-top: 96px; padding: 40px 20px; }
          .about-actions { align-items: stretch; flex-direction: column; }
          .about-action { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .about-size-option,
          .about-action { transition: none; }
        }
      `}</style>

      <main className="about-page">
        <nav className="about-nav" aria-label="Breadcrumb">
          <Link href="/" className="link-draw">Home</Link>
          <span aria-hidden="true">/</span>
          <span>About</span>
        </nav>

        <header className="about-intro">
          <h1>About Darpan</h1>
          <div className="about-intro-copy">
            <p className="about-lead">
              Darpan means mirror. It helps you know how large a piece will
              look on your face before you buy it.
            </p>
            <p>
              Product photography cannot show what a 2 cm or 6 cm drop might
              look like beside your face. Earring previews use an average
              iris size as one scale reference; the photo and category affect
              how the result appears.
            </p>
            <ul className="about-facts">
              <li>Earring scale uses an average adult iris reference of about 11.7 mm.</li>
              <li>Render checks do not guarantee perceived size on every face or screen.</li>
              <li>Necklaces, watches, rings and bracelets use different assumptions.</li>
              <li>Your photo is used only for your try-on.</li>
              <li>Cached samples cost nothing to browse.</li>
            </ul>
          </div>
        </header>

        <section className="about-section" aria-labelledby="size-is-hard">
          <h2 id="size-is-hard">Why size is hard online</h2>
          <p>
            A product page gives you a measurement, but not a feeling for its
            scale beside your eye, cheek, ear, or neck. These earring examples
            use the same sample face and show two selected product heights.
          </p>
          <div className="about-size-pair">
            <figure className="about-figure">
              <img
                className="about-image"
                src="/hero/size-2.webp"
                alt="A 2 centimetre jewellery size on the sample face"
              />
              <figcaption className="about-caption">2 cm on our sample face</figcaption>
            </figure>
            <figure className="about-figure">
              <img
                className="about-image"
                src="/hero/size-6.webp"
                alt="A 6 centimetre jewellery size on the same sample face"
              />
              <figcaption className="about-caption">6 cm on the same face</figcaption>
            </figure>
          </div>
        </section>

        <section className="about-section" aria-labelledby="measurement-works">
          <div className="about-measure-grid">
            <div>
              <h2 id="measurement-works">How we measure</h2>
              <p>
                The average visible adult iris is about 11.7 mm wide. Darpan
                uses that population average as a reference when estimating
                earring scale in a photo. We compare the rendered earring
                with its selected product size; the check describes the render
                and does not guarantee how large it looks on every face or
                screen.
              </p>
              <div className="about-measure-note about-control">
                <p>
                  Choose a product height to see the selected measurement.
                  This control does not change the sample photos above.
                </p>
                <input
                  className="about-range"
                  type="range"
                  min={2}
                  max={6}
                  step={0.5}
                  value={requestedCm}
                  onChange={event => setRequestedCm(Number(event.target.value))}
                  aria-label="Jewellery height in centimetres"
                />
                <div className="about-size-options" aria-label="Jewellery sizes">
                  {SIZE_OPTIONS.map(size => (
                    <button
                      key={size}
                      type="button"
                      className="about-size-option"
                      aria-pressed={requestedCm === size}
                      onClick={() => setRequestedCm(size)}
                    >
                      {size.toFixed(1)} cm
                    </button>
                  ))}
                </div>
                <p className="about-measure-result">
                  Selected earring height: {requestedCm.toFixed(1)} cm.
                </p>
              </div>
            </div>
            <figure className="about-figure">
              <img
                className="about-image about-face-image"
                src="/sample-face.png"
                alt="Sample face used to illustrate the average iris reference for earring scale"
              />
              <figcaption className="about-caption">
                The average iris width is a reference for this earring example,
                not a measurement of every shopper’s iris.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="about-section" aria-labelledby="photo-use">
          <div className="about-privacy-grid">
            <div>
              <h2 id="photo-use">What we do with your photo</h2>
              <p>
                Your photo is used for your requested try-on and sent to
                YouCam for processing. Darpan protects it with a private
                browser session, expires access after 24 hours and removes
                expired files during daily cleanup.
              </p>
              <p>
                Cached samples cost nothing to browse. When you use your own
                portrait, it gives the try-on a face to work with; it is not a
                claim about who you are.
              </p>
            </div>
            <ul className="about-privacy-facts">
              <li>Private access: your photo and results require your browser session.</li>
              <li>Try-on only: your photo is not used for another purpose.</li>
              <li>You control Darpan copies: delete your photo and previews after processing.</li>
            </ul>
          </div>
        </section>

        <section className="about-section" aria-labelledby="youcam-api">
          <div className="about-api-copy">
            <h2 id="youcam-api">Built on the YouCam API</h2>
            <p>
              Try-on rendered by the YouCam API from Perfect Corp. Darpan
              sends the selected jewellery and photo to the try-on service.
              The result is a visual guide; scale behavior depends on the
              category, product image and photo.
            </p>
            <p>
              Sample looks are cached, so browsing costs nothing. The cache
              lets you understand the experience before you choose to try a
              piece on your own photo.
            </p>
          </div>
          <ul className="about-api-list">
            <li>
              <strong>Earrings</strong>
              <span>An average iris reference helps estimate scale; the render is checked against product size.</span>
            </li>
            <li>
              <strong>Necklaces</strong>
              <span>Necklace length is approximate.</span>
            </li>
            <li>
              <strong>Watches</strong>
              <span>Scale uses an assumed 60 mm average wrist.</span>
            </li>
            <li>
              <strong>Rings and bracelets</strong>
              <span>Prepared ring references use a selected US size to estimate stone proportions. Other rings and bracelets use visual auto-fit.</span>
            </li>
          </ul>
        </section>

        <section className="about-cta" aria-labelledby="try-on-heading">
          <h2 id="try-on-heading">See how a piece might look</h2>
          <p>
            Start with the collection, choose a piece, and use the try-on as a
            visual guide alongside its listed measurements.
          </p>
          <div className="about-actions">
            <Link className="about-action" href="/collection">Try on me</Link>
            <Link className="link-draw about-secondary-link" href="/collection">Browse the collection</Link>
          </div>
        </section>

        <p className="about-credits">
          Photo credits: the Met pieces are from The Met Open Access collection (CC0). The two watch photographs are by Kanderstegen on Wikimedia Commons (CC BY 3.0).
        </p>
      </main>
    </>
  )
}
