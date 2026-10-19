# YouCam Feasibility Test Report (B0)

**Date:** 2026-10-15  
**Node Version:** v24.18.0  
**Project Directory:** E:\Chaos\Hackathons\Youcam

---

## 1. Environment Check

✅ **Node version:** v24.18.0 (>= 18 requirement satisfied)

---

## 2. Scripts Created

1. `scripts/feasibility.mjs` - Main feasibility script with task runner and logging
2. `scripts/run_tests.mjs` - Test orchestration script (for future use)
3. `scripts/check_api.mjs` - API validation script
4. `scripts/download_inputs.mjs` - Input image downloader
5. `scripts/measure_diffs.mjs` - Image diff measurement (requires canvas npm package)
6. `scripts/measure_diffs.ps1` - PowerShell-based image measurement
7. `scripts/measure_images.ps1` - Input image dimension measurement

---

## 3. API Key Status

❌ **API Key Validation:** FAILED

**Error:** 401 Unauthorized - "InvalidAccessToken"

**Details:**
- API Base URL: `https://yce-api-01.makeupar.com`
- Key format: Bearer token (starts with "Psk-3kJXgj...")
- Status check endpoint: `/s2s/v1.0/client/credit`
- Response: `{"status": 401, "error": "Unauthorized", "error_code": "InvalidAccessToken"}`

**Action taken:** Stopped further API tests as per instructions when key is rejected.

---

## 4. Input Images Downloaded

✅ **Images successfully downloaded to:** `outputs/b0/inputs/`

### Face Image
- **Source:** https://plugins-media.makeupar.com/strapi/assets/sample_Image_1_202b6bf6e6.jpg
- **Dimensions:** 1080 × 1437 pixels
- **File size:** 113.17 KB
- **Path:** `E:\Chaos\Hackathons\Youcam\outputs\b0\inputs\face.jpg`

### Earring Image (The Met, Object 446792)
- **Source:** https://images.metmuseum.org/CRDImages/is/original/LC-15_95_129.jpg
- **Dimensions:** 1379 × 2068 pixels
- **File size:** 1.95 MB
- **Long side:** 2068 pixels
- **Path:** `E:\Chaos\Hackathons\Youcam\outputs\b0\inputs\earring.jpg`

### API Requirements Check for Earring Image
- **Long side ≤ 4096:** ✅ PASS (2068 ≤ 4096)
- **File size < 10 MB:** ✅ PASS (1.95 < 10)
- **Result:** Earring image meets API requirements for URL-based submission

---

## 5. Task Tests Status

### Planned Tests (NOT EXECUTED due to API key issue):
1. **Test A:** Earring at 3cm scale (`earring_3cm`)
2. **Test B:** Earring at 6cm scale (`earring_6cm`) - only if Test A succeeds
3. **Test C:** Earring at 4.5cm scale (`earring_4_5cm`) - only if both succeed

### Task Body Template (would have been used):
```json
{
  "src_file_url": "https://plugins-media.makeupar.com/strapi/assets/sample_Image_1_202b6bf6e6.jpg",
  "ref_file_urls": ["https://images.metmuseum.org/CRDImages/is/original/LC-15_95_129.jpg"],
  "source_info": { "name": "<FACE_URL>" },
  "object_infos": [
    {
      "name": "<EARRING_URL>",
      "parameter": {
        "earring_need_remove_background": true,
        "earring_anchor_point": null,
        "earring_wearing_location": null,
        "earring_scale": 3.0,
        "earring_is_right_ear": true,
        "earring_occluded_type": 0,
        "earring_shadow_intensity": 0.15,
        "earring_ambient_light_intensity": 1.0
      }
    }
  ]
}
```

---

## 6. Measurement Scripts Ready

### For future use when API key works:
1. **Pixel diff measurement:** `scripts/measure_diffs.mjs` (requires `npm install canvas`)
2. **Basic dimension check:** `scripts/measure_diffs.ps1` (PowerShell, no dependencies)

**Measurement approach:** Compare output images with input face to find bounding box of changed pixels (absolute RGB difference > 40 on any channel).

---

## 7. Unit Budget Status

**MAX BUDGET:** 4 units for successful tasks  
**ACTUAL USAGE:** 0 units (no tasks executed due to API key issue)  
**FAILED TASKS:** 1 (API key validation)

---

## 8. Files Created

### Scripts:
- `scripts/feasibility.mjs`
- `scripts/run_tests.mjs`
- `scripts/check_api.mjs`
- `scripts/download_inputs.mjs`
- `scripts/measure_diffs.mjs`
- `scripts/measure_diffs.ps1`
- `scripts/measure_images.ps1`

### Outputs:
- `outputs/b0/inputs/face.jpg` (115,883 bytes)
- `outputs/b0/inputs/earring.jpg` (2,040,077 bytes)
- `outputs/b0/feasibility_report.md` (this file)

### Logs:
- No API logs generated (no successful API calls)

---

## 9. Issues and Blockers

### Critical Blocker:
1. **Invalid API Key** - The provided `YOUCAM_API_KEY` in `.env.local` returns 401 Unauthorized with error code "InvalidAccessToken"

### Required Actions to Unblock:
1. Obtain a valid YouCam API key from the hackathon registration
2. Ensure the key matches the correct environment/region
3. Update `.env.local` with the valid key
4. Re-run `scripts/check_api.mjs` to verify

### Notes:
- According to PLAN.md: "YOUCAM_API_KEY set as an environment variable (never pasted in chat) + which YouCam site was used to sign up."
- This suggests the key may need to be obtained from a specific YouCam site used for hackathon signup.

---

## 10. Next Steps When API Key Works

1. Run `node scripts/check_api.mjs` to verify credit balance and feature costs
2. Execute earring tests sequentially:
   - Test A (3cm): `node scripts/run_tests.mjs`
   - Test B (6cm): Only if Test A succeeds
   - Test C (4.5cm): Only if both succeed
3. Run measurement: `powershell -File scripts\measure_diffs.ps1`
4. Calculate height ratio: `height(6cm) / height(3cm)`

---

## 11. Summary

✅ **Completed:**
- Environment verification (Node v24.18.0)
- All required scripts created
- Input images downloaded and measured
- Directory structure prepared

❌ **Blocked:**
- API key invalid (401 Unauthorized)
- Cannot proceed with paid API tests
- Credit balance unknown
- Feature costs unknown

⚠️ **Ready for execution once API key is fixed.**

---

**Report generated by:** B0 Feasibility Test Script  
**Time:** 2026-10-15T23:41:00+05:30