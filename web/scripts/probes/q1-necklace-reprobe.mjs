#!/usr/bin/env node

import { upload, runTask, getCreditBalance, request } from './lib.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '../../..')
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs', 'probes')
const INPUTS_DIR = path.join(OUTPUTS_DIR, 'inputs')

async function main() {
  console.log('=== Q1: NECKLACE REPROBE ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Step 1: Generate front-facing face image using text-to-image
  console.log('\n--- Step 1: Generate front-facing face image ---')
  const facePrompt = 'photorealistic studio portrait of a young woman facing the camera directly, hair tied back, bare neck and collarbones visible, wearing a plain off-shoulder black top, neutral grey background, soft even light, sharp focus, framed from top of head to mid-chest'
  const textToImageBody = {
    model: 'youcam-image-v2',
    prompt: facePrompt,
    negative_prompt: 'blurry, low quality, distorted, watermark, text, other people, multiple faces',
    size: '1104*1472',
    prompt_extend: true
  }
  
  console.log('Text-to-image request for face:', JSON.stringify(textToImageBody, null, 2))
  
  const textToImageResult = await runTask('/s2s/v2.0/task/text-to-image/youcam', textToImageBody)
  
  if (!textToImageResult.resultImageUrl) {
    throw new Error('No result image URL from text-to-image generation')
  }
  
  // Download the generated face image
  const faceImagePath = path.join(INPUTS_DIR, 'gen_face_front.png')
  const imageResponse = await fetch(textToImageResult.resultImageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`)
  }
  
  const imageBuffer = await imageResponse.arrayBuffer()
  fs.writeFileSync(faceImagePath, Buffer.from(imageBuffer))
  console.log(`Generated front-facing face saved to: ${faceImagePath}`)
  console.log(`File size: ${(imageBuffer.byteLength / 1024).toFixed(1)} KB`)
  
  // Get intermediate balance after text-to-image
  const intermediateBalance1 = await getCreditBalance()
  const textToImageUnits = startBalance - intermediateBalance1
  console.log(`Text-to-image units used: ${textToImageUnits}`)
  
  // Step 2: Upload source face image
  console.log('\n--- Step 2: Upload generated front-facing face ---')
  const srcFileId = await upload(faceImagePath)
  console.log(`Uploaded front-facing face: ${srcFileId}`)
  
  // Step 3: Upload necklace image from existing file
  console.log('\n--- Step 3: Upload existing necklace image ---')
  const necklacePath = path.join(INPUTS_DIR, 'gen_necklace.png')
  if (!fs.existsSync(necklacePath)) {
    throw new Error(`Necklace image not found at ${necklacePath}`)
  }
  const refFileId = await upload(necklacePath)
  console.log(`Uploaded necklace: ${refFileId}`)
  
  // Step 4: Run necklace VTO task
  console.log('\n--- Step 4: Run necklace VTO task ---')
  const necklaceRequestBody = {
    src_file_id: srcFileId,
    ref_file_ids: [refFileId],
    source_info: {
      name: "gen_face_front.png"
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
  
  try {
    const necklaceResult = await runTask('/s2s/v2.0/task/2d-vto/necklace', necklaceRequestBody)
    
    // Save the result
    const resultPath = path.join(OUTPUTS_DIR, 'q1-necklace.png')
    const resultResponse = await fetch(necklaceResult.resultImageUrl)
    if (!resultResponse.ok) {
      throw new Error(`Failed to download result image: ${resultResponse.status}`)
    }
    
    const resultBuffer = await resultResponse.arrayBuffer()
    fs.writeFileSync(resultPath, Buffer.from(resultBuffer))
    console.log(`\nNecklace VTO result saved to: ${resultPath}`)
    
    // Get final balance
    const finalBalance = await getCreditBalance()
    const necklaceVtoUnits = intermediateBalance1 - finalBalance
    const totalUnits = textToImageUnits + necklaceVtoUnits
    
    console.log(`\n--- Q1 Results ---`)
    console.log(`Text-to-image completed in ${textToImageResult.elapsedSeconds.toFixed(1)}s`)
    console.log(`Necklace VTO completed in ${necklaceResult.elapsedSeconds.toFixed(1)}s`)
    console.log(`Text-to-image units: ${textToImageUnits}`)
    console.log(`Necklace VTO units: ${necklaceVtoUnits}`)
    console.log(`Total units used: ${totalUnits}`)
    console.log(`Ending balance: ${finalBalance} units`)
    
    // Return the result for chaining
    return {
      success: true,
      srcFileId,
      refFileId,
      resultPath,
      textToImageUnits,
      necklaceVtoUnits,
      totalUnits
    }
    
  } catch (error) {
    console.error(`\nNecklace VTO failed: ${error.message}`)
    
    // Check if it's error code 4
    if (error.message.includes('error 4') || error.message.includes('4')) {
      console.log('Error 4 detected. Checking documentation...')
      
      // Try background removal first
      console.log('\n--- Attempting background removal on necklace image ---')
      const sodBody = {
        src_file_id: refFileId,
        parameters: {
          prompt: "product photo of a single delicate gold chain necklace with a small round pendant",
          background_prompt: "plain white background"
        }
      }
      
      console.log('SOD request:', JSON.stringify(sodBody, null, 2))
      const sodResult = await runTask('/s2s/v2.0/task/sod', sodBody)
      
      // Upload the SOD result
      const sodImagePath = path.join(OUTPUTS_DIR, 'necklace_sod_result.png')
      const sodResponse = await fetch(sodResult.resultImageUrl)
      if (!sodResponse.ok) {
        throw new Error(`Failed to download SOD image: ${sodResponse.status}`)
      }
      
      const sodBuffer = await sodResponse.arrayBuffer()
      fs.writeFileSync(sodImagePath, Buffer.from(sodBuffer))
      console.log(`SOD result saved to: ${sodImagePath}`)
      
      // Upload SOD result
      const sodRefFileId = await upload(sodImagePath)
      console.log(`Uploaded SOD necklace: ${sodRefFileId}`)
      
      // Try necklace VTO again with background-removed image
      console.log('\n--- Retrying necklace VTO with background-removed necklace ---')
      const retryNecklaceRequestBody = {
        src_file_id: srcFileId,
        ref_file_ids: [sodRefFileId],
        source_info: {
          name: "gen_face_front.png"
        },
        object_infos: [
          {
            name: "necklace_sod_result.png",
            parameter: {
              necklace_need_remove_background: false, // Already removed
              necklace_shadow_intensity: 0.5,
              necklace_ambient_light_intensity: 0.5
            }
          }
        ]
      }
      
      console.log('Retry necklace VTO request:', JSON.stringify(retryNecklaceRequestBody, null, 2))
      const retryNecklaceResult = await runTask('/s2s/v2.0/task/2d-vto/necklace', retryNecklaceRequestBody)
      
      // Save the retry result
      const retryResultPath = path.join(OUTPUTS_DIR, 'q1-necklace.png')
      const retryResultResponse = await fetch(retryNecklaceResult.resultImageUrl)
      if (!retryResultResponse.ok) {
        throw new Error(`Failed to download retry result image: ${retryResultResponse.status}`)
      }
      
      const retryResultBuffer = await retryResultResponse.arrayBuffer()
      fs.writeFileSync(retryResultPath, Buffer.from(retryResultBuffer))
      console.log(`\nRetry necklace VTO result saved to: ${retryResultPath}`)
      
      // Get final balance
      const finalBalance = await getCreditBalance()
      const sodUnits = intermediateBalance1 - (await getCreditBalance())
      const retryNecklaceVtoUnits = sodUnits - (finalBalance - sodUnits)
      const totalUnits = textToImageUnits + sodUnits + retryNecklaceVtoUnits
      
      console.log(`\n--- Q1 Results (with retry) ---`)
      console.log(`Text-to-image units: ${textToImageUnits}`)
      console.log(`SOD units: ${sodUnits}`)
      console.log(`Retry necklace VTO units: ${retryNecklaceVtoUnits}`)
      console.log(`Total units used: ${totalUnits}`)
      console.log(`Ending balance: ${finalBalance} units`)
      
      return {
        success: true,
        srcFileId,
        refFileId: sodRefFileId,
        resultPath: retryResultPath,
        textToImageUnits,
        sodUnits,
        necklaceVtoUnits: retryNecklaceVtoUnits,
        totalUnits
      }
    }
    
    throw error
  }
}

main().catch(error => {
  console.error(`\nQ1 failed: ${error.message}`)
  process.exit(1)
})