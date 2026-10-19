# Darpan — See it at actual size

Hackathon: YouCam API Skin AI & eCommerce VTO Hackathon (Devpost)
Deadline: Nov 2, 2026, 10:15 pm IST. **Target: submit Nov 1 night.**
Plan updated: Oct 15, 2026.
Build order: **backend first, then frontend.**

---

## 1. The idea

**The one pain point:** online shoppers can't tell how big an earring will look on *them*. The page says "Height: 57 mm", the photo is on a model or white background, and the earring arrives smaller or bigger than expected. Reviews repeat: *"much smaller than I expected, even though the spec is correct."*

**What Darpan is:** a true-size earring try-on for online jewellery stores.
- **Store (our customer):** adds each earring once with its image and real size in cm.
- **Shopper:** clicks **Try on me**, uploads one photo, sees the earring on their own ear **at its real size**, with a measuring line and a size check.

**Scope**
| Item | Status | Why |
|---|---|---|
| Single earrings | **Core** | YouCam has a real-size setting (`earring_scale`, in cm) |
| Ear stacks | **Core** | Same setting, stacked earrings |
| Necklace | Optional, labelled "approximate" | No size setting; placement only |
| Hair up/down, lipstick, metal match | Optional toggles, off by default | Nice extras, not the product |
| Watch, bracelet, ring | **Removed** | No size control; rings/bangles auto-fit, and fit can't be measured from a photo |
| Face-shape rules, lighting simulation, chatbot | **Removed** | Unreliable or unnecessary |

**Name:** Darpan (Hindi: mirror). Tagline: *See it at actual size.*

---

## 2. How real size works

1. **YouCam draws the earring at the real size.** We pass the store's cm value to `earring_scale`.
2. **We check it with an iris ruler.** The iris (coloured ring of the eye) is ~11.7 mm wide in almost all adults (±0.4 mm). Iris width in pixels -> pixels per cm.
3. **Size check:** compare the photo before and after; the changed pixels are the earring. Measure its height in px -> cm. Show *"Asked 6.0 cm, rendered 5.8 cm (±10%)"*.
4. **Correction:** if a photo renders consistently off (e.g. 6.0 -> 5.2), re-render once with a corrected value and reuse that correction for other earrings on the same photo.
5. **Best photo:** turned 30–45° with the ear visible (YouCam says side photos work best; it also puts the ear at about the same distance from the camera as the eye, so the ruler is fairer). Measure the iris **vertically** on turned photos.
6. **Honest limit:** always show "about ±10%". Shoppers choose between sizes 25–50% apart, so this is enough.

**Lighting:** YouCam matches the earring to the photo's lighting by default (`earring_ambient_light_intensity` = 1.0). We only reject photos that are too dark.

**Testing without real jewellery:** render the same earring at 3, 4.5 and 6 cm on one photo. Pass if 6 cm measures about twice 3 cm, and each is close to its requested size.

---

## 3. Reasons we might win
1. One clear pain point, shown in one second (same earring at 3 cm vs 6 cm).
2. Built for e-commerce stores, like 3 of 5 Round 1 winners.
3. Almost no Round 1 project used jewellery try-on.
4. It checks itself (asked vs rendered size) — the honesty Round 1 winners were rewarded for.
5. Deep API use: `earring_scale`, stacking, `earring_wearing_location`, `earring_occluded_type`.
6. Cheap: 1–2 units per try-on, so judges can actually test it.

## 4. Reasons we might lose — and the fix
| Risk | Fix |
|---|---|
| Looks like another AI stylist | Lead with size. No chatbot. Extras off by default. |
| `earring_scale` doesn't change size properly | Layer B0 tests it first. Fallback: we resize the earring image ourselves before sending. |
| Ruler inaccurate | Show ±10%; consistency test in B0/B3. |
| Bad photos | Free photo check with tips before spending units. |
| Judges can't test | Live until Nov 20, 450 units reserved, per-visitor cap, sample photo with saved results. |
| Too narrow | Ear stacks + optional necklace + store admin show depth. |
| Image/brand rules | The Met CC0 or YouCam-generated images, fictional store, no copyrighted music, `CREDITS.md`. |

---

## 5. Test images
- **People:** our own selfies (front + turned, ear visible, good light) **or** faces made with YouCam's AI Image Generator, labelled "AI-generated". YouCam doc sample photos for quick API tests. Do **not** use Unsplash/Pexels faces.
- **Earrings:** The Met Open Access (CC0) or YouCam AI Image Generator ("single gold hoop earring, front view, plain white background"). Clean with YouCam background removal if needed.
- Every asset listed in `CREDITS.md`.

---

## 6. BACKEND (build first)

Stack: Next.js API routes (TypeScript) on Vercel. Products stored in a JSON file (no database). API key server-only.

### B0 — Feasibility test script (Oct 16–17) — ~40 units
A standalone Node script (`scripts/feasibility.mjs`) using the exact documented request formats.
Tests:
1. One earring at 3 / 4.5 / 6 cm on a turned photo (and once on a front photo).
2. Ear stack: two studs of different sizes.
3. `earring_occluded_type` 1 vs 2 (hair covering vs clear).
4. `earring_wearing_location` set by us vs auto.
5. Chaining: earring result -> second step (`dst_id` vs result URL).
6. Necklace: auto placement vs our two points.
Save every output image + a JSON log (request, status, error, seconds, units).
**GO if:** size clearly changes with `earring_scale` and the earring doesn't look pasted on.

### B1 — YouCam client (Oct 18–19)
`lib/youcam.ts`:
- `uploadFile(buffer, type)` -> `POST /s2s/v2.0/file`, then PUT bytes to the returned URL with returned headers -> `file_id`.
- `createTask(feature, body)` and `getTask(feature, taskId)`.
- `credits()` -> current unit balance.
- Typed errors; retry on 429 with backoff.

### B2 — API routes (Oct 19–20)
| Route | Does |
|---|---|
| `POST /api/photo` | Upload shopper photo, return `photoId` |
| `POST /api/tryon` | `{ photoId, productId, options }` -> create earring (and optional) task(s), return `jobId` |
| `GET /api/tryon/:jobId` | Poll status; return result URL when done |
| `GET /api/products`, `POST /api/products` | List / add products (admin) |
| `GET /api/health` | Key valid + units left |

Browser polls every 2–3 s; server calls YouCam once per poll (fits Vercel time limits).

### B3 — Size engine (Oct 21–23)
- Input: before image, after image, iris width in px (sent from browser MediaPipe).
- Diff the images -> earring bounding box -> height px -> cm.
- Return `{ requestedCm, renderedCm, errorPct, withinTolerance }`.
- Per-photo correction factor and one re-render if error > 10%.
- Unit tests with fixed images.

### B4 — Safety and cost (Oct 23–24)
- Cache: hash(photo + product + size + options) -> saved result, 0 units on repeat.
- Per-visitor cap (~20 units) and global floor (stop at 450 left before Nov 20).
- Validate uploads (type, size < 10 MB, long side <= 4096).
- Never send the key to the browser; `.env.example` only in git.

### B5 — Products and admin data (Oct 24–25)
- Product: `id, name, type (single|stack|necklace), imageFileId, heightCm, widthCm, anchorPoint, metal, price` (necklace: `lengthCm`, `dropCm`, two chain-end points).
- Seed 10–12 demo earrings + 2 necklaces with real cm sizes.

**Backend done when:** a script/HTTP call can upload a photo, run a true-size try-on, return the result and the size check, with caching and caps working.

---

## 7. FRONTEND (build second)

Stack: Next.js + Tailwind + Framer Motion. MediaPipe Tasks Vision 1.1.1 in the browser.

### F1 — Photo capture and check (Oct 26–27)
- Upload or camera. MediaPipe Face Landmarker: face found, ear side visible, iris >= 40 px, not too dark.
- Friendly tips: "turn your head a little", "tuck hair behind ear", "move closer", "more light".
- Send iris width to backend.

### F2 — Store product page + Try on me (Oct 27–28)
- Fictional store: grid of earrings, product page with size in cm, **Try on me** button.

### F3 — Try-on screen (Oct 28–29)
- Result in the centre with a measuring line (cm) next to the earring.
- Size check badge ("Asked 6.0 cm, rendered 5.8 cm, ±10%").
- Size flip: compare two sizes of the same design instantly (pre-rendered).
- Progress steps while waiting. Add to cart. Share link.

### F4 — Optional toggles (Oct 29–30)
Hair covering vs clear, necklace ("approximate"), hair up/down, lipstick, metal match. All off by default. Cut order if late: metal match -> lipstick -> hair up/down -> necklace.

### F5 — Store admin page (Oct 30)
Add earring: upload image, enter height/width in cm, click hook point, test render, publish.

### F6 — Polish and submit (Oct 31–Nov 1)
Sample-photo button with cached results, mobile layout, video, screenshots, README, LICENSE (MIT), CREDITS.md, Devpost text. Submit Nov 1.

---

## 8. Demo video (under 3 min)
| Time | Screen |
|---|---|
| 0:00–0:20 | "57 mm means nothing on a product page." Same earring at 3 cm vs 6 cm on a face. |
| 0:20–0:45 | Store adds an earring with its real size. |
| 0:45–1:50 | Shopper: Try on me -> photo check -> earring at real size -> size check -> ear stack. YouCam API named at each step. |
| 1:50–2:20 | Optional toggles (hair, necklace approximate). |
| 2:20–2:45 | Honest limits (±10%) and units per try-on. |

---

## 9. Unit budget
| Use | Units |
|---|---|
| B0 test | 40 |
| Building | 200 |
| Demo cache | 100 |
| Reserve for judges (until Nov 20) | 450 |
| Spare | ~210 |
Claim social-share bonus (up to 2 x 500).

---

## 10. Key API facts (docs.perfectcorp.com)
- Base `https://yce-api-01.makeupar.com`, header `Authorization: Bearer <key>`.
- Upload: `POST /s2s/v2.0/file` -> PUT bytes to returned URL -> `file_id`.
- Earrings: `POST /s2s/v2.0/task/2d-vto/earring`; body has `src_file_url|src_file_id`, `ref_file_urls|ref_file_ids` (arrays), `source_info`, `object_infos[{ name, parameter{ earring_scale (cm), earring_is_right_ear (person's own ear), earring_wearing_location [x,y], earring_anchor_point, earring_occluded_type 0/1/2, earring_shadow_intensity, earring_ambient_light_intensity, earring_need_remove_background } }]`. Parameters only work if the product image shows ONE earring. 1 unit (stacked 2).
- Necklace: `POST /s2s/v2.0/task/2d-vto/necklace`; `necklace_wearing_location` (2 points on photo), `necklace_anchor_point` (2 chain ends on product). No size setting. 1 unit.
- Makeup (lipstick): `POST /s2s/v2.0/task/makeup-vto`, `version: "1.0"`, `effects:[{category:"lip_color", shape:{name:"original"}, palettes:[{color,texture,colorIntensity}], style:{type:"full"}}]`; send `skin_smooth` 0. 1 unit.
- Hair Style v2.1: `POST /s2s/v2.1/task/hair-transfer`, `hair_color:"src"`. JPG, long side <= 1024. 2 units.
- Poll `GET <path>/{task_id}` until `success`/`error`. Units charged only on success. Result URL valid 2 h. Rate limit 250 requests / 5 min.

---

## 11. Submission checklist
- [ ] Public repo: code, README, LICENSE, `.env.example`, `CREDITS.md`, no secrets.
- [ ] Live demo until Nov 20 with units left.
- [ ] Description: pain point, store + shopper, YouCam APIs used, honest limits.
- [ ] Screenshots + 1–3 min public YouTube video.
- [ ] Opt into Women in Tech / Rising Star if eligible.
- [ ] Submitted Nov 1.

## 12. Needed to start B0
1. `YOUCAM_API_KEY` set as an environment variable (never pasted in chat) + which YouCam site was used to sign up.
2. Test photos: our own selfies (front + turned, ear visible) OR permission to generate faces with YouCam's AI Image Generator.