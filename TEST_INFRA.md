# E2E Test Infra: Darpan ("Kaari Studio")

## Test Philosophy
- **Opaque-Box & Requirement-Driven**: Tests are derived strictly from `ORIGINAL_REQUEST.md` and user-facing requirements, never relying on implementation internals.
- **Zero Backend Modification**: Never modify existing backend tests (`web/tests/*.test.ts`) or API files.
- **Methodology**: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Test Architecture
- **Runner**: Node-based E2E runner script (`scripts/e2e-runner.mjs`) and test suite files (`tests/e2e/*.test.mjs`).
- **Pass/Fail Semantics**: Clean exit code 0 on all suites; non-zero on any failure.
- **Directory Layout**:
  - `web/tests/e2e/tier1-features.test.mjs`: Tier 1 Feature Coverage (happy path per feature).
  - `web/tests/e2e/tier2-boundaries.test.mjs`: Tier 2 Boundary & Corner Cases.
  - `web/tests/e2e/tier3-pairwise.test.mjs`: Tier 3 Cross-Feature Combinations.
  - `web/tests/e2e/tier4-scenarios.test.mjs`: Tier 4 Real-World Application Workloads.

## Feature Inventory Coverage Matrix

| # | Feature | Requirement | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|-------------|:------:|:------:|:------:|:------:|
| 1 | Product Gallery & Info | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 2 | Physical Size Selector | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 3 | Try-On Trigger (`?tryon=1`) | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 4 | Photo Step & Dropzone | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 5 | Sample Face Pre-calibration | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 6 | Iris Calibration Calipers | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 7 | Ear & Sizing Options | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 8 | Processing Step (M5) | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 9 | Result Reveal Choreography (M6) | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 10 | Before/After Split Slider | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 11 | Ruler & Comparison Toggles | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 12 | Result Download Button | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 13 | Complete the Look Presets | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 14 | 0-Unit Synchronous Execution | §R1, AC | ≥5 | ≥5 | ✓ | ✓ |
| 15 | Bag Slide-Over Sheet (`useCart`) | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 16 | Inline Error Recovery | §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 17 | M0 Preloader | §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 18 | M1 Hero Size Scrub | §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 19 | M2 Pinned Narrative | §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 20 | M3 Product Collection Grid | §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 21 | M12 Category Rail | §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 22 | M13 Atelier Marquee | §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 23 | Glint/BoxReveal/MacroTilt | §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 24 | /admin Token Auth & Header | §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 25 | Seed Product Protection | §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 26 | /look/[id] Hydration | §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 27 | /stylist Recommendations | §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 28 | /about Editorial Explainer | §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 29 | Zero Backend Regressions | §R4 | ≥5 | ≥5 | ✓ | ✓ |
| 30 | Keyboard Focus & A11y | §R4 | ≥5 | ≥5 | ✓ | ✓ |
| 31 | Reduced Motion Handlers | §R4 | ≥5 | ≥5 | ✓ | ✓ |
| 32 | Viewport Responsiveness | §R4 | ≥5 | ≥5 | ✓ | ✓ |
| 33 | Verification Pipeline Clean | AC | ≥5 | ≥5 | ✓ | ✓ |

## Real-World Application Scenarios (Tier 4)
1. **Shopper Flow 1**: Sample face 0-unit Gilded Teardrop 3.0 cm try-on → reveal → split slider comparison → complete the look (lipstick preset) → add to bag → verify bag badge and local storage.
2. **Shopper Flow 2**: Custom photo upload → iris ruler manual drag → "USE AVERAGE" 11.7mm toggle → ear selection left → simulated processing sequence → split slider inspect → download.
3. **Stylist & Look Permalinks Flow**: User opens `/stylist` → picks warm skin tone and royal navy swatch → receives Zari Gold & Brick Red recommendation → follows link to product → creates look → permalink saved and verified at `/look/[id]`.
4. **Admin Store Management Flow**: Admin logs in with `x-admin-token` → checks API health & units → attempts to delete seed product (blocked with 403) → creates new runtime product with live cm scale → verifies product appears in collection grid.
5. **Accessibility & Reduced Motion Flow**: User navigates full page with Tab / Shift-Tab keys → verifies 2px `--gold` focus rings on all interactive elements → activates `prefers-reduced-motion: reduce` → verifies instant static transitions without animation timers.

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: ≥ 165 tests (5 × 33 features)
- **Tier 2 (Boundary & Corner)**: ≥ 165 tests (5 × 33 features)
- **Tier 3 (Cross-Feature Combinations)**: ≥ 33 pairwise tests
- **Tier 4 (Real-World Scenarios)**: ≥ 5 end-to-end user workflows
- **Total E2E Test Suite Goal**: ≥ 368 automated test cases
