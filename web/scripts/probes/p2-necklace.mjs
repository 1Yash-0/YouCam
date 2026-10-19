#!/usr/bin/env node

import { upload, runTask, saveProbeResults, getCreditBalance, request } from './lib.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '../../..')
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs', 'probes')
const INPUTS_DIR = path.join(OUTPUTS_DIR, 'inputs')

async function main() {
  console.log('=== P2: Necklace Probe ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Step 1: Generate necklace product image using text-to-image
  console.log('\n--- Step 1: Generate necklace product image ---')
  const textToImageBody = {
    model: 'youcam-image-v2',
    prompt: 'product photo of a single delicate gold chain necklace with a small round pendant, laid flat in a U shape, front view, centred, plain white background, sharp focus',
    negative_prompt: 'blurry, low quality, distorted, watermark, text',
    size: '1328*1328',
    prompt_extend: true
  }
  
  console.log('Text-to-image request:', JSON.stringify(textToImageBody, null, 2))
  
  const textToImageResult = await runTask('/s2s/v2.0/task/text-to-image/youcam', textToImageBody)
  
  if (!textToImageResult.resultImageUrl) {
    throw new Error('No result image URL from text-to-image generation')
  }
  
  // Download the generated necklace image
  const necklaceImagePath = path.join(INPUTS_DIR, 'gen_necklace.png')
  const imageResponse = await fetch(textToImageResult.resultImageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`)
  }
  
  const imageBuffer = await imageResponse.arrayBuffer()
  fs.writeFileSync(necklaceImagePath, Buffer.from(imageBuffer))
  console.log(`Generated necklace saved to: ${necklaceImagePath}`)
  console.log(`File size: ${(imageBuffer.byteLength / 1024).toFixed(1)} KB`)
  
  // Get intermediate balance after text-to-image
  const intermediateBalance = await getCreditBalance()
  const textToImageUnits = startBalance - intermediateBalance
  console.log(`Text-to-image units used: ${textToImageUnits}`)
  
  // Step 2: Upload source face image
  console.log('\n--- Step 2: Upload source face image ---')
  const facePath = path.join(ROOT_DIR, 'outputs/b0/inputs/gen_face.png')
  const srcFileId = await upload(facePath)
  console.log(`Uploaded face: ${srcFileId}`)
  
  // Step 3: Upload generated necklace image
  console.log('\n--- Step 3: Upload generated necklace image ---')
  const refFileId = await upload(necklaceImagePath)
  console.log(`Uploaded necklace: ${refFileId}`)
  
  // Step 4: Run necklace VTO task
  console.log('\n--- Step 4: Run necklace VTO task ---')
  // According to docs: source_info and object_infos with necklace parameters
  const necklaceRequestBody = {
    src_file_id: srcFileId,
    ref_file_ids: [refFileId],
    source_info: {
      name: "gen_face.png"
    },
    object_infos: [
      {
        name: "gen_necklace.png",
        parameter: {
          necklace_need_remove_background: true,
          necklace_shadow_intensity: 0.5,
          necklace_ambient_light_intensity: 0.5
        }
      }
    ]
  }
  
  console.log('Necklace VTO request:', JSON.stringify(necklaceRequestBody, null, 2))
  
  const necklaceResult = await runTask('/s2s/v2.0/task/2d-vto/necklace', necklaceRequestBody)
  
  // Get final balance
  const finalBalance = await getCreditBalance()
  const necklaceVtoUnits = intermediateBalance - finalBalance
  const totalUnits = textToImageUnits + necklaceVtoUnits
  
  console.log(`\n--- P2 Results ---`)
  console.log(`Text-to-image completed in ${textToImageResult.elapsedSeconds.toFixed(1)}s`)
  console.log(`Necklace VTO completed in ${necklaceResult.elapsedSeconds.toFixed(1)}s`)
  console.log(`Text-to-image units: ${textToImageUnits}`)
  console.log(`Necklace VTO units: ${necklaceVtoUnits}`)
  console.log(`Total units used: ${totalUnits}`)
  console.log(`Final balance: ${finalBalance} units`)
  
  // Save text-to-image results
  saveProbeResults('p2-text-to-image', textToImageBody, textToImageResult, textToImageResult.elapsedSeconds, textToImageResult.resultImageUrl)
  
  // Save necklace VTO results
  saveProbeResults('p2-necklace-vto', necklaceRequestBody, necklaceResult, necklaceResult.elapsedSeconds, necklaceResult.resultImageUrl)
  
  return {
    success: true,
    textToImage: {
      requestBody: textToImageBody,
      unitsUsed: textToImageUnits,
      elapsedSeconds: textToImageResult.elapsedSeconds,
      savedPath: necklaceImagePath
    },
    necklaceVto: {
      requestBody: necklaceRequestBody,
      unitsUsed: necklaceVtoUnits,
      elapsedSeconds: necklaceResult.elapsedSeconds,
      resultImageUrl: necklaceResult.resultImageUrl ? necklaceResult.resultImageUrl.substring(0, 50) + '...' : null
    },
    totalUnits
  }
  
}

main().then(result => {
  console.log('\n=== P2 Summary ===')
  console.log(JSON.stringify(result, null, 2))
}).catch(error => {
  console.error(`P2 failed: ${error.message}`)
  
  // Save error results
  const errorResult = {
    status: 500,
    data: { error: error.message }
  }
  saveProbeResults('p2-necklace-error', {}, errorResult, 0)
  
  process.exit(1)
})