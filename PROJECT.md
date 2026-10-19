# Project: Darpan ("Kaari Studio")

## Architecture
- **Framework**: Next.js 15.5.28 (App Router), React 19.1.0, TypeScript 5.9.3, Tailwind CSS v4.
- **Frontend Architecture**:
  - `src/app/`: File-system routes (`/`, `/p/[id]`, `/admin`, `/look/[id]`, `/stylist`, `/about`).
  - `src/components/`: Reusable UI primitives (`BoxReveal`, `Glint`, `MacroTilt`, `PillButton`, `Toast`, `Header`, `CartDrawer`).
  - `src/components/tryon/`: Try-On Drawer subsystems (photo upload, iris ruler calipers, processing sequence, result reveal & split slider, complete-the-look presets, bag slide-over).
  - `src/components/home/`: Editorial homepage modules (M0 preloader, M1 hero scrub, M2 iris ruler narrative, M3 product grid, M12 category rail, M13 marquee).
  - `src/hooks/`: Stateful domain hooks (`useScrollProgress`, `useCart`, `useTryOn`, `useAdmin`).
  - `src/lib/api-client.ts`: Typed client-side API bridge to existing backend routes.
- **Backend Architecture (Protected Read-Only)**:
  - `src/app/api/`: 17 REST endpoints for health, sample faces, photos, products, try-on pipeline jobs, recommendation, styling, looks, and admin.
  - `src/lib/`: Core pipeline, size calculations, color science, and rate-limiting guard.
  - `tests/`: 14 test files with 125 Vitest tests ensuring 100% backend integrity.

## Feature Inventory
Every feature from the Survey phase and user requirements is cataloged and assigned to a milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Product Gallery & Info | Editorial gallery, INR pricing, product descriptions, stock status | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Physical Size Selector | Physical chip selector (`2.0`, `3.0`, `4.5`, `6.0` cm) with visual scale cue | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Try-On Trigger | "TRY ON ME" button triggering slide-over drawer with `?tryon=1` query param | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Photo Step & Dropzone | Photo upload dropzone and primary "USE A SAMPLE FACE" action | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Pre-calibrated Sample Face | Instant load of sample face (`f813b082...`, 37px iris, teardrop 3cm right ear) | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Iris Calibration Ruler | Zoomable photo display with draggable gold iris calipers, "USE AVERAGE" (11.7mm) fallback | M1 | ORIGINAL_REQUEST §R1 |
| 7 | Ear & Sizing Options | Ear selector (`AUTO / LEFT / RIGHT`) and target size confirmation | M1 | ORIGINAL_REQUEST §R1 |
| 8 | Processing Step (M5) | Light sweep effect, dynamic step sequence (`OUTFIT → HAIR → LIPSTICK → EARRING`), 1px progress hairline | M1 | ORIGINAL_REQUEST §R1 |
| 9 | Result Reveal Choreography (M6) | Sequential reveal: clip-path wipe → gold measuring line → tabular cm counter → tolerance verdict chip | M1 | ORIGINAL_REQUEST §R1 |
| 10 | Before/After Split Slider | Keyboard-accessible split slider (measuring line, ticks, size label inside After layer only) | M1 | ORIGINAL_REQUEST §R1 |
| 11 | Ruler & Comparison Toggles | "Ruler" toggle (on by default), "Compare with: Original \| Earring only" toggle | M1 | ORIGINAL_REQUEST §R1 |
| 12 | Try-On Result Download | High-res result download button (excludes ruler unless active) | M1 | ORIGINAL_REQUEST §R1 |
| 13 | Complete the Look Presets | One-tap presets (lipstick, Two Braids updo, Emerald Silk Blouse, Dot Stud stack) with "Change" popover | M1 | ORIGINAL_REQUEST §R1 |
| 14 | Synchronous 0-Unit Execution | Untouched ruler on sample face resolves from cache synchronously with 0 units spent | M1 | ORIGINAL_REQUEST §R1 & AC |
| 15 | Bag Slide-Over Sheet | Cart slide-over with product thumb + try-on thumb ("Tried on you at 3.0 cm ✓"), quantity stepper, INR subtotal, localStorage | M1 | ORIGINAL_REQUEST §R1 |
| 16 | Inline Error Recovery | Editorial error card replacing processing with dimmed photo, single guidance sentence, primary recovery action | M1 | ORIGINAL_REQUEST §R1 |
| 17 | M0 Preloader | Masked wordmark reveal with gold hairline (max 1.4s, session-based) | M2 | ORIGINAL_REQUEST §R2 |
| 18 | M1 Signature Hero Scrub | 240vh scroll spacer, canvas crossfade across physical render sizes (2.0 to 6.0 cm), gold measurement line | M2 | ORIGINAL_REQUEST §R2 |
| 19 | M2 Pinned Narrative | 300vh scroll-driven iris ruler narrative with eye zoom (scale 2.2x) and px count display | M2 | ORIGINAL_REQUEST §R2 |
| 20 | M3 Product Collection Grid | Editorial product grid with hover worn-photo crossfades, filter chips, floating cursor label | M2 | ORIGINAL_REQUEST §R2 |
| 21 | M12 Category Rail | Minimalist category silhouette rail with smooth anchor navigation | M2 | ORIGINAL_REQUEST §R2 |
| 22 | M13 Atelier Marquee | Infinite editorial text marquee with luxury spacing and metallic accents | M2 | ORIGINAL_REQUEST §R2 |
| 23 | Signature Visual Primitives | Integration of `<Glint>`, `<BoxReveal>`, and `<MacroTilt>` physics on homepage & cards | M2 | ORIGINAL_REQUEST §R2 |
| 24 | /admin Route | Token-protected route (`x-admin-token`), API health/units monitor, create product with live cm preview, delete product | M3 | ORIGINAL_REQUEST §R3 |
| 25 | Seed Product Protection | Admin UI enforces immutability on seed products (`data/products.json`) | M3 | ORIGINAL_REQUEST §R3 |
| 26 | /look/[id] Route | Permalink view restoring saved product presets, hair/outfit/lipstick options, one-tap try-on trigger | M3 | ORIGINAL_REQUEST §R3 |
| 27 | /stylist Route | Interactive skin tone & outfit swatch picker integrating `/api/recommend/lipstick` and `/api/recommend/metal` | M3 | ORIGINAL_REQUEST §R3 |
| 28 | /about Route | Editorial explanation of true-size accuracy, privacy, and YouCam API integration with interactive visual cards | M3 | ORIGINAL_REQUEST §R3 |
| 29 | Zero Backend Regression | Strict read-only enforcement on `web/src/app/api/`, `web/src/lib/`, `web/data/`, and all 125 tests | M4 | ORIGINAL_REQUEST §R4 |
| 30 | Accessibility & Focus Rings | Full keyboard navigation, 2px `--gold` `:focus-visible` rings, ARIA live regions | M4 | ORIGINAL_REQUEST §R4 |
| 31 | Reduced Motion Compliance | Full support for `prefers-reduced-motion: reduce` with instant static fallbacks | M4 | ORIGINAL_REQUEST §R4 |
| 32 | Viewport Responsiveness | Responsive across 360px, 768px, 1280px, and 1920px viewports | M4 | ORIGINAL_REQUEST §R4 |
| 33 | Verification Pipeline Pass | `npm test` (125+ tests), `npm run typecheck` (0 errors), `npm run lint` (0 errors), `npm run build` (clean) | M4 | ORIGINAL_REQUEST AC |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Try-On Drawer Vertical Slice | Features 1–16: `/p/[id]` detail page, `<TryOnDrawer>` with 7-step states, iris ruler calipers, 0-unit sample face caching, split slider, complete-the-look presets, cart slide-over, error recovery | None | DONE |
| M2 | Homepage & Editorial Visuals | Features 17–23: `app/page.tsx`, M0 preloader, M1 240vh hero size scrub, M2 300vh iris narrative, M3 collection grid with worn-photo crossfades, M12 category rail, M13 atelier marquee | None | PLANNED |
| M3 | Secondary Routes & Admin | Features 24–28: `/admin` (token auth, live cm preview, product management), `/look/[id]`, `/stylist` (swatch recommendations), `/about` | M1 | PLANNED |
| M4 | Final Integration & E2E Verification | Features 29–33: 100% E2E test suite pass, zero regressions on 125 backend tests, full typecheck, lint, and build verification | M1, M2, M3 | PLANNED |

## Interface Contracts

### Product Page & Drawer (`/p/[id]` ↔ `<TryOnDrawer>`)
- State sync via URL search params: `?tryon=1` opens drawer; closing cleans search params.
- Active product prop: `Product` object from `GET /api/products/[id]`.
- Selected size prop: `sizeCm: 2.0 | 3.0 | 4.5 | 6.0`.

### Drawer Subsystems (`<TryOnDrawer>` ↔ Pipeline Services)
- Step transitions: `photo -> measure -> processing -> result`.
- Sample Face selection: Pre-loads `photoId: "f813b0825ce8b5f0dd103b255ec7410af0c6a8003b8f4b92198de200696f3b9c"`, `irisPx: 37`, target size `3.0`, ear `"right"`.
- Submission payload: `POST /api/tryon` with `{ photoId, productId, sizeCm, ear, irisPx, steps?: ... }`.
- Immediate completion: if status is `"done"`, skip polling and proceed directly to result reveal.
- Polling: if status is `"pending"`, poll `GET /api/tryon/[jobId]` every 1000ms until `"done"`.

### Cart State (`useCart` ↔ Bag Sheet & Header)
- Storage key: `darpan_bag_v1` in `localStorage`.
- Item schema: `{ id, productId, title, price, sizeCm, quantity, productThumb, tryonThumb, addedAt }`.
- Header sync: Dispatches custom event `storage` / React Context state so Header bag counter updates in real time.

### Admin Panel (`/admin` ↔ `/api/admin/*`)
- Token storage: Session / component state storing admin token.
- Headers: `x-admin-token: <token>`.
- Product mutation: `POST /api/admin/products`, `DELETE /api/admin/products/[id]`.
- Health check: `GET /api/health` displaying active balance and reserve status.

## Code Layout
- Exclusive file boundaries for workers:
  - **M1 Worker**:
    - `web/src/app/p/[id]/page.tsx`
    - `web/src/components/tryon/*` (`TryOnDrawer.tsx`, `PhotoStep.tsx`, `MeasureStep.tsx`, `ProcessingStep.tsx`, `ResultStep.tsx`, `SplitSlider.tsx`, `CompleteTheLook.tsx`, `CartDrawer.tsx`, `ErrorCard.tsx`)
    - `web/src/hooks/useCart.ts`, `web/src/hooks/useTryOn.ts`
  - **M2 Worker**:
    - `web/src/app/page.tsx`
    - `web/src/components/home/*` (`Preloader.tsx`, `HeroScrub.tsx`, `IrisNarrative.tsx`, `ProductGrid.tsx`, `CategoryRail.tsx`, `AtelierMarquee.tsx`)
    - `web/public/hero/*`
  - **M3 Worker**:
    - `web/src/app/admin/page.tsx`
    - `web/src/app/look/[id]/page.tsx`
    - `web/src/app/stylist/page.tsx`
    - `web/src/app/about/page.tsx`
    - `web/src/components/admin/*`, `web/src/components/stylist/*`
  - **E2E Testing Track**:
    - `web/tests/e2e/*`
    - `web/scripts/e2e-runner.mjs`
    - `TEST_INFRA.md`, `TEST_READY.md`
  - **Protected Files (Strict Read-Only)**:
    - `web/src/app/api/**`
    - `web/src/lib/**`
    - `web/data/**`
    - `web/tests/setup.ts`, `web/tests/*.test.ts` (existing 125 tests)
