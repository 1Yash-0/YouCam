# Darpan — Handover (checked 2026-10-19)

## State

- **Builds and tests:** `npm run typecheck`, `npm test` (705 pass) and `npm run build` all pass in `web/`.
- **Backend:** real end-to-end runs worked for earring, lipstick + earring, and necklace.
- **Run locally:** `cd web; npm run dev` and open http://localhost:3000. Live try-ons need the YouCam key in `.env.local`.
- **Units:** about 1,010 left. Keep 450 in reserve for judges until Nov 20.
- **Rules:**
  - Never commit `.env.local`.
  - Add `.data/` to the root `.gitignore`.
  - Don't modify `src/lib/*` or `src/app/api/*` unless an item below says so.

Everything below was checked in the code, not guessed. Fix the P0 items first.

---

## P0 — Fix before anything else (a judge will notice; some are false claims)

**1. Two of the four hero frames are fake (product photo pasted on the face).**
- `public/hero/size-2.webp/.png` and `size-4_5.webp/.png` show a white rectangle with the product photo pasted on the ear. Only `size-3` and `size-6` are real YouCam renders.
- The boxes in `public/hero/size-2.json` and `size-4_5.json` are also invented (linear scaling of 3 cm), not measured.
- **Fix:** render 2 cm and 4.5 cm for real (2 units) and save the `measurement.box` from the API result into the JSON files. Then update `HERO_FRAMES` in `src/components/home/HeroScrub.tsx` (lines 14–19), which duplicates the JSON.
  ```js
  POST /api/tryon {photoId:<gen_face>, productId:'gilded-teardrop', sizeCm:2, ear:'right', irisPx:<measured>}
  ```

**2. The "03 Render" step pastes the product PNG on the face.** In `src/components/home/IrisNarrative.tsx` (~lines 230–248), step 3 overlays `/products/teardrop-gold.png` at a fixed 41×95 px. **Fix:** crossfade to `/hero/size-3.webp` (the real render) and draw the ruler from `size-3.json`'s box.

**3. The product image has no transparency.** `public/products/teardrop-gold.png` has 3 channels and no alpha (verified with sharp), which causes every white box behind the earring. It also breaks `<Glint>`, whose alpha mask needs a cutout. **Fix:** make a transparent cutout: YouCam SOD background removal (1 unit) or a sharp white-to-alpha threshold. Check `dot-stud.png` and `orb-chain.png` the same way.

**4. The iris ruler on the home page sits on the cheek, not the eye.**
- In `IrisNarrative.tsx` (~lines 255–295) the caliper is centred in the stage with flexbox. After zooming with `transformOrigin 56.48% 33.15%`, the eye stays at about (56%, 33%), so the ruler lands on the cheek.
- Its width is `irisPx * 2.8` screen px, an arbitrary number.
- The label counts 16→37 while the body text hard-codes "37 px … 31.6"; the screenshots show 32 px next to 27.4.
- **Fix:** position the caliper absolutely in image coordinates, using the same transform as the image. Drive every number from a single constant.

**5. The sample iris value is probably wrong.**
- `SAMPLE_IRIS_PX = 37` (`src/hooks/useTryOn.ts:15`). On a zoomed crop of `public/sample-face.png` I measured the iris at about **41 px (±2)**, centred around (617, 479).
- `SAMPLE_EYE_COORDS` is (623.5, 488), which is close.
- 37 vs 41 px is about an 11% size error, outside our ±10% claim.
- **Fix:** measure the iris edges properly (zoom to 800%, take both limbus edges) and store `{x1, x2, y}` once. Use it in the hero, How it works, MeasureStep and the backend smoke defaults. Then re-render the hero frames with that value.

**6. The skin-tone API is fake.** `src/app/api/analyse/skin-tone/route.ts` (lines 48–75) returns hard-coded colours (`#F5D0C5`…) and never calls YouCam. It isn't used by the UI. **Fix:** either delete the route or wire it to `youcam.createTask('skin-tone-analysis', …)` behind the guard (20 units). Don't present it as real.

**7. False privacy claim.**
- `src/app/about/AboutClient.tsx` (lines 57, 69, 74, 328–335) and `about/page.tsx:8` claim "ZERO PHOTO RETENTION … destroyed automatically upon session completion" and "±10% TOLERANCE GUARANTEED".
- In reality, the backend stores photos and results in `DATA_DIR` with no deletion, and YouCam keeps uploaded files for 30 days.
- **Fix:** either implement deletion (a cron or on-request cleanup of `photos/` older than 24 h) and say "deleted within 24 hours", or state the truth: "stored temporarily to cache results; never used for training; YouCam file links expire."
- Change "guaranteed" to "size check within ±10%, using the average iris (11.7 mm)".
- Update `src/__tests__/routes/about.test.tsx` (lines 21–80), which asserts these strings.

**8. Wrong company name.** `AboutClient.tsx:57` says "CyberLink YouCam". The sponsor is **Perfect Corp.** ("YouCam API by Perfect Corp."), which matters for this hackathon.

**9. Overclaiming copy in How it works.** `IrisNarrative.tsx`:
- **Line 120:** "PROPRIETARY OPTICAL CALIBRATION".
- **Line 165:** "precisely locating corneal boundaries".
- **Line 181:** "near-universal … all adult populations … exact conversion".
- **Lines 195–205:** "Sub-Millimeter Physical Accuracy", "precisely 95 pixels", "mathematically verified", and a TOLERANCE VERIFIED ✓ badge that is always shown.

Also `useTryOn.ts:21` says "Calibrating sub-millimeter…".

Suggested replacements:
- Eyebrow: "HOW SIZING WORKS".
- Step 2: "An adult iris is about 11.7 mm wide. We use yours as a ruler."
- Step 3: "We measure the rendered earring and check it against the size you chose (within ±10%)."
- Remove the always-on badge.

Update `src/components/home/home-components.test.ts` (lines 125–145) accordingly.

**10. Fake measuring line when there's no measurement.** `src/components/tryon/SplitSlider.tsx:124` falls back to `{x:360,y:648,w:28,h:95}` when `measurement` is missing, so a ruler and size appear that were never measured. `ResultStep.tsx` (lines 123–125) falls back to `sample-face.png` as the "after" image. **Fix:** hide the ruler and verdict when `measurement` is absent (necklaces show "Approximate size"). Show an error state instead of the bare sample face.

**11. Hosting will break caching and the sample face.**
- On Vercel, `DATA_DIR` is `/tmp`, which is wiped on cold starts and not shared between instances.
- `SAMPLE_PHOTO_ID` (`useTryOn.ts:13`) is a hash that exists only in your local `.data/`.
- So on Vercel: "Use a sample face" 404s, the cache and pre-warm are lost (costing units on every judge visit), and admin products, looks and sample-gallery manifests vanish.
- **Fix:** deploy to a host with a persistent disk (Render, Railway or Fly.io volume) and mount `DATA_DIR` there. Alternatively, ship the sample face and pre-rendered results as static files and make the sample flow read them directly.

---

## P1 — Layout and navigation (from the screenshots, confirmed in code)

**12. The header covers content.**
- `src/components/Header.tsx`:
  - It's a vertical 6-link menu (lines 39–46, 87–117), making the header about 150 px tall.
  - It's fixed at z-40 with `mix-blend-mode: difference` on every page and section (line 59).
- That overlaps "How Darpan measures reality", the step buttons and the photos.
- **Fix:**
  - Use one row, at most 72 px: wordmark | horizontal nav | Bag | Try on me.
  - Use the difference blend only while over the hero; elsewhere, a solid `--paper` background with a 1px `--line` border.
  - Give all sticky sections `top: 72px`, or `pt-[72px]`.

**13. The "blue" lines and dot are gold inverted by the blend mode.**
- Gold `#B08A3E` under `mix-blend-mode: difference` on cream turns blue.
- This affects the progress hairline (lines 155–163) and the active dot (line 99).
- The second line across the photo is the progress bar's white/20 track, inverted.
- **Fix:** solved by #12 (no blend outside the hero). Inside the hero, use white for the hairline and dot.

**14. Admin is in the public nav.** Remove it from `navLinks` (line 45); keep it only in the footer.

**15. Nav anchors go nowhere.**
- `/#necklaces` and `/#samples` have no matching `id` on the home page.
- `src/app/page.tsx` has no sample-looks section at all; the plan's "Sample looks strip" from `GET /api/sample` is missing.
- **Fix:**
  - Add `<section id="samples">` with the sample gallery (real results only).
  - Make Necklaces link to a filtered collection (`/#collection?type=necklace`, or the existing `darpan:category` event).

**16. The hero composition is off.**
- `HeroScrub.tsx`:
  - The canvas is `translateY(30vh)` at the start (line 233), which leaves a cream band at the top. The white title (line 312) sits half on cream, so it's unreadable.
  - Cover-fit on a wide 16:9 screen crops a 3:4 portrait to the middle band, so you see a huge face and a tiny earring.
- **Fix:**
  - Place the portrait in the right half of the screen (contain-fit, head to shoulders) and put the title in ink on paper on the left.
  - Alternatively, keep full-bleed but add a dark scrim behind the title and start the canvas at 0.
  - Recompute the SVG ruler transform to match whichever fit you choose (lines 216–219).

**17. Inconsistent margins.** The header uses `2rem`, the hero `p-8 md:p-16`, and How it works `px-6 md:px-12 lg:px-20`. Use one container: `px-8` (2rem) everywhere, max width 1440.

**18. The How it works stage is cut off.** The `h-screen` sticky stage with a 4:5 image overflows at 1280×700; the image bottom and the black badge are hidden. **Fix:** set `max-h: calc(100vh - 72px - 4rem)` on the image box, and vertically centre the text column against it.

**19. Wrong "worn" hover images.** In `src/components/home/ProductCard.tsx` (lines 13–17):
- `met-gold-earring` shows the teardrop 6 cm render.
- `met-gold-pendant` shows the teardrop 3 cm render.
- `dot-stud` shows the stack.

Hovering a product shows a different product worn. **Fix:** only show a worn image when it really is that product; otherwise use the product cutout plus the glint.

**20. Leftover Next.js template files.** Delete `src/app/page.module.css` and `public/{file,globe,next,vercel,window}.svg`.

**21. Mock mode wasn't built.** `NEXT_PUBLIC_MOCK` isn't referenced anywhere, so UI work spends real units. **Fix:** add fixture responses in `src/lib/api-client.ts`, gated by `NEXT_PUBLIC_MOCK=1`, and fail the build if it's set in production.

---

## P2 — Polish and QA

22. **Test warnings:** fix the missing `alt` in the ProductCard coarse-pointer test (`tests/m2-interaction-stress.test.ts` 3.10) and the "invalid hook call" warning in the test run.
23. **Hard-coded off-palette colours:**
    - `LookClient.tsx:269` and `PhysicalScalePreview.tsx` (lines 166–174) use their own gold gradients.
    - `CompleteTheLook.tsx` (lines 7–10) duplicates the lipstick palette. Read it from `/api/recommend/lipstick` or `data/lipsticks.json` instead.
24. **Fake hair-template cache:** `src/app/api/hair/templates/route.ts:63` never expires its "24 h cache". Store `fetchedAt` and check it.
25. **The red dot on the earlobe** is in the source photo (a piercing), not a code bug. Leave it.
26. **Final QA:**
    - Screenshots at 1440, 1280, 768 and 390 px wide.
    - Keyboard-only run, reduced-motion run, axe (0 serious issues), Lighthouse ≥ 90.
    - One live end-to-end run (≤ 6 units).
    - Pre-warm all sample-face combinations on the production host, then record the demo video.

## Order of work

P0 #5 (iris) → #3 (cutout) → #1 (real frames) → #2, #4, #10 → #7, #8, #9 (copy) → #12–#18 (layout) → #11 (hosting decision) → #15, #19–#21 → P2.
