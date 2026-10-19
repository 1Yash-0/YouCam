# Darpan — See it at actual size

True-size earring virtual try-on for online jewellery stores, built on the YouCam API (Perfect Corp.) for the YouCam API Skin AI & eCommerce VTO Hackathon.

A store adds each product once with its real size in cm. The shopper uploads a photo and sees the earring on their own ear at real size, with a measuring line and a size check that uses the iris as a ruler (average 11.7 mm, ±10%).

## Repository layout

- `web/`: Next.js 15 app (frontend and API routes). See `web/API.md` for every route.
- `PLAN.md`, `FRONTEND_PLAN.md`: product and frontend plans.
- `HANDOVER.md`: current status and the full list of known issues (start here).
- `outputs/`: verified YouCam probe results and inputs (AI-generated faces, The Met CC0 images).
- `scripts/`: early feasibility scripts.

## Run locally

```powershell
cd web
copy .env.example .env.local   # then put your YouCam API key in .env.local
npm install
npm run dev                    # http://localhost:3000
```

Tests: `npm test`. Type check: `npm run typecheck`. Production: `npm run build`, then `npm start`.

Runtime data (uploaded photos, result cache, unit ledger) lives in `.data/`, which is not committed. To rebuild the sample gallery, run `node scripts/build-sample.mjs`.

## Credits

See `web/CREDITS.md`. Product images come from The Met Open Access (CC0) and the YouCam AI Image Generator.
