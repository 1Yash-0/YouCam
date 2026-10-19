# Darpan — Frontend Plan v2 (final)

The demo store "Kaari Studio" runs on Darpan, a true-size earring try-on. The look is editorial luxury: white paper, black ink, one gold accent used only for measurement. Motion always explains size; it is never decoration.

## 0. Principles

1. **One idea per screen.** Each screen does one job: the hero shows size, the grid sells products, and the drawer runs the try-on.
2. **Gold means measurement.** Use `--gold` only for the measuring line, size numbers and focus rings.
3. **Motion explains.** Every animation either shows scale (cm), shows progress, or shows where you are.
4. **Always one tap from trying on.** "Try on me" stays visible on every page.
5. **No motion is required.** With reduced motion, every animation becomes a stable frame or an instant state, and nothing breaks.
6. **Honest copy.** No fake reviews. "Kaari Studio" and all prices are fictional demo data, labelled in the footer.

## 1. Stack and tokens

- Next.js 15.5.28 (existing `web/`), React 19, TS strict.
- `tailwindcss@4.3.3`, `motion@14.3.0` (`motion/react`), `lenis@1.3.27`. No GSAP, Three.js or UI kits. Component patterns are rewritten by us.
- Fonts:
  - UI: `"Helvetica Neue", Helvetica, Arial, sans-serif`.
  - Accent: **Instrument Serif** italic (OFL, `next/font/google`), used for one word per heading.
  - Numbers: `font-variant-numeric: tabular-nums`.
- `:root` tokens:
  - Colour: `--bg:#FFFFFF`, `--paper:#F7F3EC`, `--ink:#0B0B0A`, `--ink-2:#5E5A55`, `--line:#E6E1D8`, `--gold:#B08A3E`, `--ok:#2F6B4F`, `--warn:#A3542A`.
  - Type and shape: `--fs-ui:max(11px,0.6875rem)`, `--fs-brand:max(11px,0.75rem)`, `--radius-sm:0.375rem`, `--radius-pill:999px`.
  - Easing: `--ease:cubic-bezier(.22,1,.36,1)`, `--ease-in:cubic-bezier(.55,0,1,.45)`.
  - Duration: `--dur-1:180ms`, `--dur-2:360ms`, `--dur-3:600ms`.
- `html{font-size:clamp(11px,0.833vw,16px)}`.
- Body: antialiased, `overscroll-behavior:none`.
- UI labels: uppercase, weight 700, `--fs-ui`, letter-spacing 0.02em.
- Headings: weight 500, letter-spacing -0.01em.
- Shared motion helper `useScrollProgress(ref)`:
  - Returns `p` (0–1), clamped.
  - `remap(p,a,b)` and `easeOutCubic`.
  - A single rAF loop shared by all scenes.
  - Lenis provides smooth scroll, and is disabled when reduced motion is on.

## 2. Navigation system (all pages)

- **Header:** fixed, `mix-blend-mode:difference`, white ink, padding `1.5rem 2rem`. Pointer-events are off on the header itself and on for its links.
  - Left: the `DARPAN` wordmark (130×56 frame).
  - Middle-left: the tagline `TRUE-SIZE JEWELLERY, ON YOU, BEFORE YOU BUY` (max-width 21rem).
  - Centre: a vertical menu: `EARRINGS` (morphs to `INDEX`), `NECKLACES`, `SAMPLE LOOKS`, `STYLIST`, `ABOUT`.
  - Right: `BAG (0)` and a pill `TRY ON ME`.
- **On scroll:** the menu items exit bottom-up (blur, lift, fade) and `EARRINGS` morphs to `INDEX`, as in M1. `INDEX` opens the menu overlay.
- **Menu overlay (M7):** full-screen paper sheet.
  - Links in large serif, numbered `01`–`05`, plus a small live preview of the hovered category.
  - `Esc` closes it; focus is trapped; the header button reads `CLOSE`.
- **Location cues:** a thin 1px progress hairline under the header shows page scroll. The current nav item has a 6px gold dot. Product pages show a breadcrumb `EARRINGS / GILDED TEARDROP`.
- **Mobile (<700px):**
  - The header shows the wordmark, `MENU` and the `TRY ON ME` pill.
  - Menu: full-screen sheet.
  - Product pages: a sticky bottom bar with price and "Try on me".
- **Shareable URLs:** product `/p/[id]?size=3`, try-on `/p/[id]?tryon=1`, shared look `/look/[id]`. The browser back button closes the drawer.

## 3. Pages and section order

1. `/`:
   - M0 preloader (first visit only).
   - M1 hero size-scrub.
   - M2 "How it works" pinned steps.
   - M3 collection grid.
   - Sample looks strip (`GET /api/sample`, M3 card style).
   - Footer: the line `Size check uses an average iris of 11.7 mm; accuracy ±10%.`, credits, and a demo-data notice.
2. `/p/[id]`:
   - Breadcrumb.
   - Left: gallery (product image, then a worn sample).
   - Right: name (one italic word), price, `REAL SIZE 3.0 CM`, size chips, `TRY ON ME` pill, options (off by default: Lipstick, Hair up, Outfit, Add a stud), and accordions (Specifications, Materials & care).
   - Shared-element transition from the grid card (M8).
3. Try-on drawer (M4, M5, M6), opened from any "Try on me".
4. `/look/[id]`: product preset plus "Try this look on me".
5. `/stylist`: skin and outfit swatches → metal plus lipstick suggestion, labelled "stylist convention", with "Use in try-on".
6. `/admin`: add or delete products with a live real-size preview, which demonstrates that the store enters each product's real size once.
7. `/about`: how size accuracy works, privacy, and the YouCam APIs used.

## 4. Media to prepare (all ours, no third-party media)

| File | Source | Cost |
|---|---|---|
| `hero/size-2.png`, `size-3.png`, `size-4_5.png`, `size-6.png` | Real Darpan renders of the teardrop on `gen_face.png`. 3 cm and 6 cm already exist; generate 2 cm and 4.5 cm via `/api/tryon` | 2 units |
| `hero/size-*.json` | `measurement` box per frame, read from the API result | 0 |
| `hero/poster.jpg` | First frame, darkened, used for reduced motion and slow networks | 0 |
| `brand/darpan-wordmark.svg` | Typeset `DARPAN` wordmark; the reveal is CSS/SVG, so no video is needed | 0 |
| `products/*-worn.jpg` | Hover images, cropped from the sample results | 0 |

All hero frames must be the same size with the face perfectly aligned. They are, because they come from the same source photo.

## 5. Motion prompts (one prompt per Luna task; build in this order)

Each prompt below is self-contained. Prefix every task with the common block:

> COMMON: Next.js 15 app in `web/`. Use only tokens from section 1, `motion/react`, CSS and the shared `useScrollProgress`. No new dependencies, and no code copied from component libraries. Respect `prefers-reduced-motion: reduce` with the stated fallback. Every control is keyboard-focusable with a visible 2px `--gold` focus ring (offset 3px). Animate only `transform`, `opacity`, `filter` and `clip-path`; never animate layout. Add Playwright or RTL tests for state logic. Run typecheck, test and build; report results. Never call paid YouCam endpoints.

### M0 — Wordmark preloader (first visit, max 1.4 s)

Build `<Preloader/>`, shown once per session (`sessionStorage`) over a `--paper` background.
- The `DARPAN` wordmark (SVG text, 0.32em tracking, centred) is masked.
- A 1px vertical `--gold` line travels left→right across it over 900 ms with `--ease`. Letters reveal behind the line via `clip-path: inset(0 X% 0 0)`.
- At the end, the line turns into a horizontal hairline under the word, labelled `0.0 CM → TRUE SIZE` in `--fs-ui`.
- The sheet then lifts: translateY 0→-100% over 600 ms with `--ease-in`, revealing the hero underneath, already at frame 1.
- It never blocks interaction for more than 1.4 s. A hidden "Skip" button is focused first.
- Reduced motion: no preloader.

### M1 — Hero "size scrub" (signature scene; adapted from the editorial fixed-overlay pattern)

Single fixed-overlay hero driven by a 240vh `.scroll-spacer` (aria-hidden).
- **Layers:**
  - `section.hero` is fixed full-bleed with z 10. It starts at `margin-top:30vh` and JS moves it to 0.
  - Inside it, a `<canvas>` draws the 4 real renders (`size-2/3/4_5/6`).
  - Title, CTA block and product overlay sit on top with `mix-blend-mode:difference`.
- **Title:** fixed at bottom `calc(70vh + 1.5rem)`, size `clamp(2rem,2.5rem,3rem)`, weight 500. Text: `See it at ` + italic serif `actual` + ` size.`
- **CTA block:** bottom-right, uppercase copy `EVERY PIECE IS SHOWN AT ITS REAL SIZE, MEASURED AGAINST YOUR OWN EYE.`, plus a white pill `TRY ON ME` with a difference-blended label.
- **Progress:** `p = scrollY/(scrollHeight-innerHeight)`.
- **Phases:**
  - **A (0→0.18):**
    - Hero margin 30vh→0.
    - Title and CTA: opacity 1→0, y 0→-32px, blur 0→12px. Pointer-events off once phase progress passes 0.98.
    - Header items exit bottom-up within `remap(p,0,0.126)`, using the windows tagline [0,.45], ABOUT [.08,.53], STYLIST [.16,.61], SAMPLE LOOKS [.24,.69], NECKLACES [.32,.77], EARRINGS [.40,.85]. Each goes opacity 1→0, y 0→-12px, blur 0→8px.
    - `INDEX` enters over [.90,1]. Wordmark, BAG and the TRY ON ME pill stay.
  - **B (0.18→0.88) size scrub:** map `s = remap(p,.18,.88)` to size in cm, 2.0→6.0.
    - Canvas crossfades between neighbouring frames (opacity mix of frame i and i+1). Use damped value `cur += (target-cur)*0.1` per rAF.
    - The gold measuring line (SVG, overlaid in canvas coordinates) interpolates between the frames' measurement boxes, with end ticks and the live label `3.0 CM` in tabular numbers.
    - At exact sizes (2, 3, 4.5, 6) the label snaps: a 120 ms scale 1.04→1 tick.
    - Product overlay (bottom-left) enters over [.18,.36]: opacity 0→1, blur 12→0. Content: thumbnail square `calc(7rem*var(--card-scale))`, name `Gilded Teardrop`, desc `HAND-POLISHED GOLD-TONE DROP. CHOOSE 2, 3, 4.5 OR 6 CM.`, and the price `₹1,499`, which updates with the matching size.
    - `--card-scale` 1→1.6 over [.36,.88].
    - A circular `+` button (3.375rem, accessible label `Try Gilded Teardrop on me`) sits 1rem right of the product's measured right edge and opens the drawer preset to the current snapped size.
  - **C (0.88→1):** frame holds on the nearest snapped size, and the small caption `SCROLL TO EXPLORE THE COLLECTION` fades in.
- **Performance:** decode images up front with `createImageBitmap`. Canvas DPR is capped at 2. Debounce resize by 120 ms; scroll listener is passive.
- **Reduced motion:** a static `size-3` frame with a 4-chip size switcher (instant swap and line); no blur.
- **Accessibility:** a visually hidden description reads `The same photo with the Gilded Teardrop earring shown at 2, 3, 4.5 and 6 centimetres.` A live region announces snapped sizes.
- **Test:** pure functions (`remap`, the frame mix for a given `s`, `sizeFromP`) are unit-tested.

### M2 — "How it works" pinned steps (iris ruler)

A section pinned for 300vh with 3 steps. The left column holds a numbered list `01 PHOTO`, `02 MEASURE`, `03 SEE IT`; the active item is ink and the others are `--ink-2`, with a 1px gold rail that fills as you go. The right column is one stage with `clip-path` transitions between steps.
1. **Photo:** the sample face slides up into a 4:5 frame (y 40px→0, opacity). Caption: `TURN SLIGHTLY, EARS VISIBLE, HAIR TIED.`
2. **Measure:** zoom to the eye (scale 1→2.2, transform-origin at the iris).
   - A gold circle draws around the iris (SVG `stroke-dashoffset`), then a horizontal ruler draws to the right with tick marks and the label `IRIS ≈ 11.7 MM`.
   - The counter `0 → 37 PX` counts up.
3. **See it:** zoom back out. The earring fades in at 3.0 cm and the vertical measuring line draws from lobe to tip.
   - Verdict chip: `REQUESTED 3.0 CM · RENDERED 2.9 CM ✓`, with the ✓ in `--ok`.
- **Mobile:** not pinned; three stacked frames, each animating once when it scrolls into view.
- **Reduced motion:** the final state of each step, shown statically.

### M3 — Collection grid and cards

Grid: 3 columns on desktop, 2 on mobile, gap 2rem, with an editorial row ratio (1 large 4:5 card, then 2 small).
- **Card:** square image on `--paper`, name with one italic word, `REAL SIZE 3.0 CM`, price.
- **Hover/focus:**
  - The image crossfades to the worn sample (`*-worn.jpg`) with a 1.03 scale over 600 ms.
  - A gold hairline draws under the size label.
  - A small round cursor label `TRY ON` follows the pointer inside the card (lerp 0.15), desktop and pointer:fine only.
  - Keyboard focus shows the same state, with the `TRY ON` label docked bottom-right.
- **Reveal on enter:** blur 8→0, y 24→0, opacity, staggered 60 ms in reading order, once only.
- **Filter bar:** chips `ALL`, `DROPS`, `STUDS`, `NECKLACES`, sort by size or price. The list re-orders with Motion `layout` on the cards (FLIP), max 400 ms.
- **Reduced motion:** instant swaps.

### M4 — Try-on drawer (open, steps, close)

`<TryOnDrawer/>` is a right-side sheet on desktop (min(560px, 100vw)) and a full-screen sheet on mobile. Its route state lives in the URL (`?tryon=1&step=photo`).
- **Open:** page content scales 1→0.98 and dims to 40%. The drawer enters with `clip-path: inset(0 0 0 100%)` → `inset(0)` over 600 ms. Focus moves to the step title.
- **Header:** product thumb, name, size chips, and a 3-segment progress `PHOTO · MEASURE · RESULT`.
- **Step changes:** content slides x 24→0 with opacity, the direction-aware reverse when going back.
- **Photo:**
  - Drop zone with dashed `--line` border, which goes solid gold on drag-over.
  - `USE A SAMPLE FACE` is the primary action, upload the secondary.
  - Client checks: type, ≤ 10 MB, min 600 px. Errors appear inline under the zone.
- **Measure:**
  - Tap both edges of one iris on a zoomable photo; a gold ruler draws between the taps and the px value shows live.
  - `USE AVERAGE` is the skip option. Ear choice is `AUTO / LEFT / RIGHT`.
- **Close:** `Esc`, the X, the scrim or browser back. Focus returns to the trigger.
- **Reduced motion:** opacity only.

### M5 — Processing state ("polishing")

While polling `/api/tryon/[jobId]`:
- The photo sits under a slow diagonal light sweep: a linear-gradient band moving across over 2.4 s, infinite, at opacity 0.18.
- A step list from the API (`OUTFIT → HAIR → LIPSTICK → EARRING`, only the steps the job actually runs) shows the current step with a pulsing 6px gold dot, done steps with ✓ and pending ones in `--ink-2`.
- Below it: a 1px progress hairline that eases toward `(stepIndex+0.5)/totalSteps`, and copy that rotates every 4 s (`MEASURING YOUR EAR`, `MATCHING THE LIGHT`, `PLACING AT 3.0 CM`).
- After 3 minutes, show a timeout card with Retry. A cached result skips this state (instant).
- `aria-live="polite"` announces step changes.
- **Reduced motion:** no sweep; text only.

### M6 — Result reveal (the money shot)

1. The result image wipes in over the original with `clip-path: inset(0 100% 0 0)` → `inset(0)` over 700 ms with `--ease`.
2. Then the gold measuring line draws lobe to tip (300 ms) with end ticks.
3. Then the label counts from 0.0 to the rendered cm (400 ms, tabular numbers).
4. Then the verdict chip pops: `REQUESTED 3.0 CM · RENDERED 2.9 CM ✓ WITHIN 10%`, or a `--warn` "Adjusted" note when the size was corrected.

After the reveal:
- **Compare:** a before/after slider handle (keyboard arrows step 5%, `role="slider"`).
- **Size chips:** switching size crossfades results. Cached sizes are instant; uncached sizes show M5 inline.
- **Actions row:** `ADD TO BAG` pill (demo bag count with a +1 tick), `SHARE LOOK` (copies the link and shows the toast `LINK COPIED`), `DOWNLOAD`, and `TRY ANOTHER PHOTO`.
- **Notes:** show `identityNote` when present. Necklace results show `APPROXIMATE SIZE` instead of a verdict.
- **Errors:** each code maps to an M4-style inline card with an illustration-free icon, one sentence and one action.
- **Reduced motion:** the final state appears at once.

### M7 — Menu overlay

Opened by `INDEX` / `MENU`.
- The paper sheet drops from the top with `clip-path: inset(0 0 100% 0)` → `inset(0)` over 600 ms.
- Links: `01 Earrings`, `02 Necklaces`, `03 Sample looks`, `04 Stylist`, `05 About`, in 4–6rem serif with one italic word each. They rise from y 100% inside overflow-hidden lines, staggered 50 ms.
- The right half shows a 4:5 preview of the hovered or focused link, crossfading.
- Bottom row: `BAG (0)`, `ADMIN`, `PRIVACY`.
- `Esc` closes the menu with the reverse animation. Focus is trapped and returns to the trigger.

### M8 — Page transitions and micro-interactions

- **Grid card → product page:** shared-element image transition with Motion `layoutId` (or the View Transitions API when supported), 500 ms. Other content fades in staggered.
- **Pill buttons:**
  - The label is difference-blended.
  - On hover the fill grows from the pointer position (`clip-path: circle()` from cursor x/y, 360 ms).
  - Magnetic pull up to 6px, pointer:fine only.
  - Press: scale 0.98.
- **Size chips:** the selected background glides between chips (Motion `layoutId`).
- **Toasts:** bottom centre, y 16→0, auto-hide after 3 s, with `role="status"`.
- **Bag count:** number roll (y -100% → 0) on change.
- **Reduced motion:** colour and opacity only.

### Research-driven additions (sources: Awwwards jewellery SOTDs, Codrops MIT demos, Behance jewellery motion)

Three signature moves, used consistently across the site:
1. **Metal glint**: a light sweep across polished gold, as in jewellery commercials.
2. **Clip-path reveals**: images open like a jewellery box or a curtain (patterns from OCCUPY and the Codrops clip-path demos).
3. **Macro tilt**: a slow perspective tilt on scroll or pointer, in the style of Unique Jewelry, done with CSS only and no WebGL.

The three are reused across the site; no extra effects are added on top.

### M9 — Metal glint (signature #1)

Build `<Glint>` to wrap any product image (grid cards, hero product overlay, product page main image, result earring crop).
- A `::after` band (`linear-gradient(105deg, transparent 40%, rgba(255,246,220,.55) 50%, transparent 60%)`, `mix-blend-mode: soft-light`) is masked to the product's alpha using `mask-image: url(product.png)` (our products are transparent PNGs).
- It travels translateX -120%→120% over 1100 ms with `--ease`, on hover/focus, once when entering the viewport, and once at the M6 result reveal (masked to the earring box only).
- Never loops, max once every 6 s per element.
- Reduced motion: a static soft highlight at 60% position.
- Test: the mask URL comes from the product, and the glint is disabled when `matchMedia` reports reduced motion.

### M10 — Jewellery-box reveal (signature #2)

Build `<BoxReveal>` for section images and headings.
- **Images:** two halves (top/bottom) of the same image in overflow-hidden wrappers open apart. `clip-path: inset(50% 0 50% 0)` → `inset(0)` over 900 ms with `--ease`, while the inner image scales 1.15→1 (the lid opening).
- **Headings:** each line is masked; text rises y 110%→0, staggered 70 ms per line. The italic word arrives 120 ms later with a 2° skew settling to 0.
- Triggered once by IntersectionObserver at 25% visibility.
- Used on: M2 stage, sample-look cards, product page gallery, About.
- The heading stays in the DOM as real text (screen readers are never delayed).
- Reduced motion: fade 200 ms.

### M11 — Macro tilt (signature #3)

Build `<MacroTilt>` (pointer:fine and no reduced motion only).
- The product image lives inside `perspective: 900px`. Pointer position maps to rotateX/Y ±6°, spring stiffness 120, damping 20.
- A cursor spotlight (`radial-gradient` at `--mx/--my`, 22% white, soft-light) follows the pointer, so the metal catches the light as it tilts.
- On touch/scroll devices it uses scroll instead: rotateX from 4° to -4° across the element's viewport pass via `useScroll`.
- Used on: product page main image and the M1 hero product thumbnail.
- Never applied to try-on result photos (faces should not tilt).

### M12 — Editorial category rail plus cursor image (menu and home)

- **Home section "Shop by silhouette":** a horizontal rail of large serif words (`Drops`, `Studs`, `Hoops`, `Chains`, `Stacks`) with native `overflow-x` and `scroll-snap`, plus arrow buttons.
- On hover/focus, a 4:5 product image follows the cursor (Motion spring 0.15 lerp; Codrops "menu image animation" pattern, MIT). It enters with clip-path `inset(100% 0 0 0)`→`inset(0)` and switches images with a 4-slice staggered reveal (Codrops "sliced image hover", MIT, max 4 slices).
- Touch: the image is shown inline above the word; no cursor follow.
- The same component powers the M7 menu preview.

### M13 — Velvet depth and atelier marquee (ambient, use sparingly)

- **Velvet depth:** the sample-looks section has a dark `--ink` velvet band. Product images sit on it at 3 parallax depths (translateY at 0.9×, 1×, 1.1× of scroll, max ±40px). Reduced motion: none.
- **Atelier marquee:** one line between sections reading `TRUE SIZE · YOUR EAR · YOUR LIGHT · NO GUESSWORK ·`, set in 1rem uppercase with 0.2em tracking.
  - Implemented as a CSS translate loop (40 s), paused on hover/focus.
  - The duplicate text copy is `aria-hidden`. It stops entirely under reduced motion.
  - Only one marquee on the whole site.

### Motion budget (anti-overload rules)

- Per viewport: at most 1 scroll-linked scene and 1 hover effect active.
- Do not combine glint, tilt and box reveal on the same element at the same moment. Order on the product page: box reveal on load, then glint once, then tilt on pointer.
- Total JS motion code under 25 KB gzipped. No WebGL, canvas only for M1.
- The try-on CTA is never animated out of view or delayed more than 300 ms.

## 5b. Design rules for every Luna task (adapted from Anthropic `frontend-design` skill, Impeccable and Taste Skill, summarised in our own words)

- Ground every visual choice in jewellery: metal, light, scale, craft. Nothing generic (no purple gradients, glass cards, emoji, stock icons, "Get started" copy).
- **Composition:**
  - One focal point per screen, with large negative space.
  - Asymmetric editorial grid: 12 columns, content often spanning columns 2–7, with a single aside column.
- **Type:** serif display with one italic word, sans UI at small sizes with tracking; no more than 4 type sizes per page.
- **Colour:** white/paper/ink, gold only for measurement and focus, ink velvet band once per page.
- **States:** every state is designed (loading, empty, error, offline, success); no spinners, use M5-style hairlines.
- **Self-review gate before reporting:**
  - Screenshots at 360, 768, 1280 and 1920 widths.
  - A keyboard-only run, and a run with reduced motion on.
  - An axe check.
  - A check of difference-blend contrast on light frames.
  - A list of anything that looks "template-like", which then gets fixed.
- **Allowed sources:** pattern ideas from Codrops (MIT), Magic UI / Motion Primitives / Animata / Cult UI (MIT), rewritten in our code with credit in `CREDITS.md`. Avoid React Bits code (Commons Clause) and Aceternity code (licence restricts redistribution); ideas only. No Behance or Awwwards assets, only inspiration.

## 6. Quality bar ("very professional")

- Spacing on a 4px scale only. Max 2 type sizes per component. Numbers are tabular.
- Copy: uppercase UI labels, sentence-case headings, no exclamation marks, Indian rupee formatting `₹1,499`.
- Every async state has a designed loading, empty, error and success state.
- Accessibility:
  - WCAG AA contrast, also checked for difference-blend text over light frames (add a fallback text shadow).
  - axe shows 0 serious issues; full flow works by keyboard.
- Performance:
  - LCP < 2.5 s, CLS < 0.05 and INP < 200 ms on mid-range mobile; Lighthouse ≥ 90 on all four categories.
  - Hero frames are WebP at about 1600 px.
- Test on Chrome, Safari (iOS) and Firefox, at 360, 768, 1280 and 1920 widths.

## 7. Build order (each phase ends with typecheck, test, build and screenshots)

- **F1** Tokens, fonts, layout shell, header, M7 menu, M8 primitives, `<Glint>`, `<BoxReveal>`, `<MacroTilt>`, typed API client, mock API mode (`NEXT_PUBLIC_MOCK=1`, 0 units).
- **F2** Generate the 2 hero frames (2 units), then build M0 and M1.
- **F3** M2, M3, M12, M13, the home page, and the sample strip.
- **F4** Product page, M4 drawer, M5 processing.
- **F5** M6 result, options, necklace flow, look, stylist and admin pages.
- **F6** Polish pass, QA matrix, one live end-to-end run (≤ 6 units), Vercel deploy.

## 8. Risks

- **Difference blend over the light gold or skin areas of the hero may hurt readability.** Test every frame; add a subtle text shadow if needed.
- **Scroll-jacking annoys judges.** Keep a native scrollbar, keep the 240vh hero track, and make "Try on me" clickable from frame 1.
- **Frame alignment.** All hero frames come from one source photo; verify pixel alignment before building M1.
