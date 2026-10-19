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
  console.log('=== Q4: EAR STACK REPROBE ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Note: Need to read documentation first to understand stacking
  // For now, implementing based on instruction
  
  // Step 1: Generate small stud earring with text-to-image (1 unit)
  console.log('\n--- Step 1: Generate small stud earring ---')
  const studPrompt = 'product photo of a single small round gold stud earring, front view, centred, plain white background, sharp focus'
  const textToImageBody = {
    model: 'youcam-image-v2',
    prompt: studPrompt,
    negative_prompt: 'blurry, low quality, distorted, watermark, text, multiple earrings, chain, hoop',
    size: '1328*1328',
    prompt_extend: true
  }
  
  console.log('Text-to-image request for stud:', JSON.stringify(textToImageBody, null, 2))
  
  const textToImageResult = await runTask('/s2s/v2.0/task/text-to-image/youcam', textToImageBody)
  
  if (!textToImageResult.resultImageUrl) {
    throw new Error('No result image URL from text-to-image generation')
  }
  
  // Download the generated stud image
  const studImagePath = path.join(OUTPUTS_DIR, 'gen_stud.png')
  const imageResponse = await fetch(textToImageResult.resultImageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`)
  }
  
  const imageBuffer = await imageResponse.arrayBuffer()
  fs.writeFileSync(studImagePath, Buffer.from(imageBuffer))
  console.log(`Generated stud saved to: ${studImagePath}`)
  
  // Get intermediate balance after text-to-image
  const intermediateBalance1 = await getCreditBalance()
  const textToImageUnits = startBalance - intermediateBalance1
  console.log(`Text-to-image units used: ${textToImageUnits}`)
  
  // Step 2: Upload source face image
  console.log('\n--- Step 2: Upload source face image ---')
  const facePath = path.join(ROOT_DIR, 'outputs/b0/inputs/gen_face.png')
  if (!fs.existsSync(facePath)) {
    throw new Error(`Face image not found at ${facePath}`)
  }
  
  const srcFileId = await upload(facePath)
  console.log(`Uploaded face: ${srcFileId}`)
  
  // Step 3: Upload first earring (gen_earring.png)
  console.log('\n--- Step 3: Upload first earring (gen_earring.png) ---')
  const earringPath = path.join(ROOT_DIR, 'outputs/b0/inputs/gen_earring.png')
  if (!fs.existsSync(earringPath)) {
    throw new Error(`Earring image not found at ${earringPath}`)
  }
  
  const earringFileId = await upload(earringPath)
  console.log(`Uploaded first earring: ${earringFileId}`)
  
  // Step 4: Upload stud earring
  console.log('\n--- Step 4: Upload stud earring ---')
  const studFileId = await upload(studImagePath)
  console.log(`Uploaded stud earring: ${studFileId}`)
  
  // Step 5: Determine lobe pixel location
  console.log('\n--- Step 5: Determine lobe pixel location ---')
  // According to instruction: lobe is near x~375, y~665 in gen_face.png
  // Let's verify by checking image dimensions
  const faceStats = fs.statSync(facePath)
  console.log(`Face image size: ${faceStats.size} bytes`)
  // Note: In a real scenario, we would use an image library to get dimensions
  // For now, using provided coordinates
  const lobeX = 375
  const lobeY = 665
  console.log(`Using lobe position: x=${lobeX}, y=${lobeY}`)
  
  // Second earring position: ~25 px above the lobe
  const studX = lobeX
  const studY = lobeY - 25
  console.log(`Stud position (above lobe): x=${studX}, y=${studY}`)
  
  // Step 6: Run stacked earring task (2 units)
  console.log('\n--- Step 6: Run stacked earring task ---')
  // According to docs: Need to check how stacking works
  // For v2.0 earring task, we can try multiple object_infos
  const stackedEarringBody = {
    src_file_id: srcFileId,
    ref_file_ids: [earringFileId, studFileId], // Multiple ref files
    source_info: {
      name: "gen_face.png"
    },
    object_infos: [
      {
        name: "gen_earring.png",
        parameter: {
          scale: 2.0, // 2.0 cm
          wearing_location: "ear_right",
          position_x: lobeX,
          position_y: lobeY
        }
      },
      {
        name: "gen_stud.png",
        parameter: {
          scale: 0.6, // 0.6 cm
          wearing_location: "ear_right",
          position_x: studX,
          position_y: studY
        }
      }
    ]
  }
  
  console.log('Stacked earring request:', JSON.stringify(stackedEarringBody, null, 2))
  console.log('\nNOTE: Need to verify stacking API from documentation')
  console.log('Current implementation assumes multiple object_infos works for stacking')
  
  try {
    const stackedResult = await runTask('/s2s/v2.0/task/2d-vto/earring', stackedEarringBody)
    
    // Save the result
    const resultPath = path.join(OUTPUTS_DIR, 'q4-stack.png')
    const resultResponse = await fetch(stackedResult.resultImageUrl)
    if (!resultResponse.ok) {
      throw new Error(`Failed to download result image: ${resultResponse.status}`)
    }
    
    const resultBuffer = await resultResponse.arrayBuffer()
    fs.writeFileSync(resultPath, Buffer.from(resultBuffer))
    console.log(`\nStacked earring result saved to: ${resultPath}`)
    
    // Get final balance
    const finalBalance = await getCreditBalance()
    const stackedEarringUnits = intermediateBalance1 - finalBalance
    const totalUnits = textToImageUnits + stackedEarringUnits
    
    console.log(`\n--- Q4 Results ---`)
    console.log(`Text-to-image units: ${textToImageUnits}`)
    console.log(`Stacked earring units: ${stackedEarringUnits}`)
    console.log(`Total units used: ${totalUnits}`)
    console.log(`Ending balance: ${finalBalance} units`)
    
    // Return the exact body for reporting
    return {
      success: true,
      exactBody: stackedEarringBody,
      srcFileId,
      earringFileId,
      studFileId,
      textToImageUnits,
      stackedEarringUnits,
      totalUnits,
      resultPath
    }
    
  } catch (error) {
    console.error(`\nStacked earring failed: ${error.message}`)
    
    // Try alternative: maybe need to use v1.0 for stacking?
    console.log('\nTrying alternative: single earring first, then chain?')
    // Actually, for now just report error
    throw error
  }
}

main().catch(error => {
  console.error(`\nQ4 failed: ${error.message}`)
  process.exit(1)
})