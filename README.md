# Darpan

True-size jewellery try-on, built on the YouCam API (Perfect Corp.) for the YouCam API Skin AI & eCommerce VTO Hackathon.

Product photos can't show how big a piece looks when worn. Darpan puts earrings, necklaces, rings, bracelets and watches on the shopper's own photo, at their real size, with the measurement shown on the result.

## What it does

- **Earrings:** scaled from the average adult iris (11.7 mm). Each render is measured afterwards and checked against the product size (±10%).
- **Watches:** sized to the real lug-to-lug length on an assumed 60 mm average wrist. The product image is refitted so the case renders at the correct proportion.
- **Rings:** the band fits the finger, and the stone is shown at its real size for the shopper's US ring size.
- **Necklaces:** chain length is set from the product.
- **Style it:** skin tone read from the photo suggests a metal and a lipstick shade, plus optional hair and outfit try-on.
- **Honest numbers:** every size on screen is measured or published. Estimates are labelled "about".

## Stack

Next.js 15 (App Router) with React 19 and TypeScript. The API routes call the YouCam API, and each render step is cached. The front end uses GSAP and Lenis for motion, sharp for image preparation, and vitest for tests.

## Run locally

```powershell
cd web
npm install
Copy-Item .env.example .env.local   # set YOUCAM_API_KEY and a private ADMIN_TOKEN
npm run dev                         # http://localhost:3000
```

The sample studio uses bundled, pre-rendered examples and spends no API units.

Checks: `npm run typecheck`, `npm test`, `npm run build`.

## Deploy

Deploy as a single service (for example on Railway):

- **Root directory:** `web`
- **Volume:** mounted at `/data`
- **Variables:** `STORAGE_DRIVER=local`, `DATA_DIR=/data`, `YOUCAM_API_KEY`, `YOUCAM_API_BASE`, `ADMIN_TOKEN`, `CRON_SECRET`

`web/railway.json` holds the build, start and health-check settings. Set the variables before the first build.

## Credits

- **Museum pieces:** The Metropolitan Museum of Art Open Access (CC0).
- **Watch photographs:** Kanderstegen, Wikimedia Commons, CC BY 3.0.
- **Generated images:** some demo product images were made with the YouCam AI Image Generator and are marked as generated.

Sources for every product are listed in `web/data/products.json`.
