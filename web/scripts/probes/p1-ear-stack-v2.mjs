#!/usr/bin/env node

import { upload, runTask, saveProbeResults, getCreditBalance } from './lib.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '../../..')

async function main() {
  console.log('=== P1: Ear Stack Probe (v2) ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Upload source face image
  const facePath = path.join(ROOT_DIR, 'outputs/b0/inputs/gen_face.png')
  const srcFileId = await upload(facePath)
  console.log(`Uploaded face: ${srcFileId}`)
  
  // Upload earring image (same image for both earrings)
  const earringPath = path.join(ROOT_DIR, 'outputs/b0/inputs/gen_earring.png')
  const refFileId = await upload(earringPath)
  console.log(`Uploaded earring: ${refFileId}`)
  
  // According to docs: For multiple earrings, we need multiple entries in ref_file_ids and object_infos
  // Coordinates from instructions: lobe ~[375,660], upper lobe ~[372,620]
  // Image is 1104x1472
  
  const requestBody = {
    src_file_id: srcFileId,
    ref_file_ids: [refFileId, refFileId], // Same earring image for both positions
    source_info: {
      name: "gen_face.png"
    },
    object_infos: [
      {
        name: "gen_earring.png",
        parameter: {
          earring_need_remove_background: true,
          earring_wearing_location: [375, 660], // lobe position
          earring_scale: 1.0, // 1.0 cm scale
          earring_is_right_ear: true,
          earring_occluded_type: 0,
          earring_shadow_intensity: 0.5,
          earring_ambient_light_intensity: 0.5
        }
      },
      {
        name: "gen_earring.png",
        parameter: {
          earring_need_remove_background: true,
          earring_wearing_location: [372, 620], // upper lobe position
          earring_scale: 2.0, // 2.0 cm scale
          earring_is_right_ear: true,
          earring_occluded_type: 0,
          earring_shadow_intensity: 0.5,
          earring_ambient_light_intensity: 0.5
        }
      }
    ]
  }
  
  console.log('Request body:', JSON.stringify(requestBody, null, 2))
  
  try {
    // Run the earring task
    const result = await runTask('/s2s/v2.0/task/2d-vto/earring', requestBody)
    
    // Get ending balance
    const endBalance = await getCreditBalance()
    const unitsUsed = startBalance - endBalance
    
    console.log(`Task completed in ${result.elapsedSeconds.toFixed(1)}s`)
    console.log(`Units used: ${unitsUsed}`)
    console.log(`Ending balance: ${endBalance} units`)
    
    // Save results
    saveProbeResults('p1-ear-stack-success', requestBody, result, result.elapsedSeconds, result.resultImageUrl)
    
    return {
      success: true,
      requestBody,
      unitsUsed,
      elapsedSeconds: result.elapsedSeconds,
      resultStatus: result.data?.data?.task_status,
      resultImageUrl: result.resultImageUrl ? result.resultImageUrl.substring(0, 50) + '...' : null
    }
    
  } catch (error) {
    console.error(`P1 failed: ${error.message}`)
    
    // Save error results
    const errorResult = {
      status: 500,
      data: { error: error.message }
    }
    saveProbeResults('p1-ear-stack-error', requestBody, errorResult, 0)
    
    return {
      success: false,
      error: error.message,
      requestBody
    }
  }
}

main().then(result => {
  console.log('\n=== P1 Summary ===')
  console.log(JSON.stringify(result, null, 2))
}).catch(console.error)