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
  console.log('=== P6: Clothes V4 Probe ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Step 1: Generate garment image using text-to-image
  console.log('\n--- Step 1: Generate garment image ---')
  const textToImageBody = {
    model: 'youcam-image-v2',
    prompt: 'product photo of a single emerald green silk blouse with a round neckline, front view, laid flat, centred, plain white background',
    negative_prompt: 'blurry, low quality, distorted, watermark, text',
    size: '1328*1328',
    prompt_extend: true
  }
  
  console.log('Text-to-image request:', JSON.stringify(textToImageBody, null, 2))
  
  const textToImageResult = await runTask('/s2s/v2.0/task/text-to-image/youcam', textToImageBody)
  
  if (!textToImageResult.resultImageUrl) {
    throw new Error('No result image URL from text-to-image generation')
  }
  
  // Download the generated garment image
  const garmentImagePath = path.join(INPUTS_DIR, 'gen_blouse.png')
  const imageResponse = await fetch(textToImageResult.resultImageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`)
  }
  
  const imageBuffer = await imageResponse.arrayBuffer()
  fs.writeFileSync(garmentImagePath, Buffer.from(imageBuffer))
  console.log(`Generated garment saved to: ${garmentImagePath}`)
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
  
  // Step 3: Upload generated garment image
  console.log('\n--- Step 3: Upload generated garment image ---')
  const refFileId = await upload(garmentImagePath)
  console.log(`Uploaded garment: ${refFileId}`)
  
  // Step 4: Run clothes V4 task
  console.log('\n--- Step 4: Run clothes V4 task ---')
  // According to docs: POST /s2s/v2.0/task/cloth-v4
  const clothesRequestBody = {
    src_file_id: srcFileId,
    ref_file_id: refFileId,
    garment_category: 'upper_body'
  }
  
  console.log('Clothes V4 request:', JSON.stringify(clothesRequestBody, null, 2))
  
  const clothesResult = await runTask('/s2s/v2.0/task/cloth-v4', clothesRequestBody)
  
  // Get final balance
  const finalBalance = await getCreditBalance()
  const clothesUnits = intermediateBalance - finalBalance
  const totalUnits = textToImageUnits + clothesUnits
  
  console.log(`\n--- P6 Results ---`)
  console.log(`Text-to-image completed in ${textToImageResult.elapsedSeconds.toFixed(1)}s`)
  console.log(`Clothes V4 completed in ${clothesResult.elapsedSeconds.toFixed(1)}s`)
  console.log(`Text-to-image units: ${textToImageUnits}`)
  console.log(`Clothes V4 units: ${clothesUnits}`)
  console.log(`Total units used: ${totalUnits}`)
  console.log(`Final balance: ${finalBalance} units`)
  
  // Save text-to-image results
  saveProbeResults('p6-text-to-image-garment', textToImageBody, textToImageResult, textToImageResult.elapsedSeconds, textToImageResult.resultImageUrl)
  
  // Save clothes V4 results
  saveProbeResults('p6-clothes-v4', clothesRequestBody, clothesResult, clothesResult.elapsedSeconds, clothesResult.resultImageUrl)
  
  return {
    success: true,
    textToImage: {
      requestBody: textToImageBody,
      unitsUsed: textToImageUnits,
      elapsedSeconds: textToImageResult.elapsedSeconds,
      savedPath: garmentImagePath
    },
    clothesV4: {
      requestBody: clothesRequestBody,
      unitsUsed: clothesUnits,
      elapsedSeconds: clothesResult.elapsedSeconds,
      resultImageUrl: clothesResult.resultImageUrl ? clothesResult.resultImageUrl.substring(0, 50) + '...' : null,
      resultStatus: clothesResult.data?.data?.task_status
    },
    totalUnits
  }
  
}

main().then(result => {
  console.log('\n=== P6 Summary ===')
  console.log(JSON.stringify(result, null, 2))
}).catch(error => {
  console.error(`P6 failed: ${error.message}`)
  
  // Save error results
  const errorResult = {
    status: 500,
    data: { error: error.message }
  }
  saveProbeResults('p6-clothes-error', {}, errorResult, 0)
  
  process.exit(1)
})