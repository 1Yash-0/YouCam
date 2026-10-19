#!/usr/bin/env node

import { upload, runTask, saveProbeResults, getCreditBalance } from './lib.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '../../..')
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs', 'probes')

async function main() {
  console.log('=== P7: Chaining Check Probe ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Step 1: Get P3 lipstick result image
  console.log('\n--- Step 1: Load P3 lipstick result ---')
  const lipstickResultPath = path.join(OUTPUTS_DIR, 'p3-lipstick.jpg')
  if (!fs.existsSync(lipstickResultPath)) {
    throw new Error(`P3 lipstick result not found at ${lipstickResultPath}`)
  }
  
  console.log(`Found lipstick result: ${lipstickResultPath}`)
  console.log(`File size: ${fs.statSync(lipstickResultPath).size} bytes`)
  
  // Step 2: Upload P3 result image
  const p3ResultFileId = await upload(lipstickResultPath, 'image/jpeg')
  console.log(`Uploaded P3 result: ${p3ResultFileId}`)
  
  // Step 3: Upload earring image
  console.log('\n--- Step 2: Upload earring image ---')
  const earringPath = path.join(ROOT_DIR, 'outputs/b0/inputs/gen_earring.png')
  const earringFileId = await upload(earringPath)
  console.log(`Uploaded earring: ${earringFileId}`)
  
  // Step 4: Run single earring on P3 result
  console.log('\n--- Step 3: Run earring on chained image ---')
  const requestBody = {
    src_file_id: p3ResultFileId,
    ref_file_ids: [earringFileId],
    source_info: {
      name: "p3-lipstick-result.jpg"
    },
    object_infos: [
      {
        name: "gen_earring.png",
        parameter: {
          earring_need_remove_background: true,
          earring_wearing_location: [375, 660], // Right ear lobe position (same as P1)
          earring_scale: 3.0, // 3.0 cm scale as requested
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
    // Run the earring task on chained image
    const result = await runTask('/s2s/v2.0/task/2d-vto/earring', requestBody)
    
    // Get ending balance
    const endBalance = await getCreditBalance()
    const unitsUsed = startBalance - endBalance
    
    console.log(`Task completed in ${result.elapsedSeconds.toFixed(1)}s`)
    console.log(`Units used: ${unitsUsed}`)
    console.log(`Ending balance: ${endBalance} units`)
    
    // Save results
    saveProbeResults('p7-chaining', requestBody, result, result.elapsedSeconds, result.resultImageUrl)
    
    return {
      success: true,
      requestBody,
      unitsUsed,
      elapsedSeconds: result.elapsedSeconds,
      resultStatus: result.data?.data?.task_status,
      resultImageUrl: result.resultImageUrl ? result.resultImageUrl.substring(0, 50) + '...' : null,
      chainingSuccessful: result.data?.data?.task_status === 'success'
    }
    
  } catch (error) {
    console.error(`P7 failed: ${error.message}`)
    
    // Save error results
    const errorResult = {
      status: 500,
      data: { error: error.message }
    }
    saveProbeResults('p7-chaining-error', requestBody, errorResult, 0)
    
    return {
      success: false,
      error: error.message,
      requestBody
    }
  }
}

main().then(result => {
  console.log('\n=== P7 Summary ===')
  console.log(JSON.stringify(result, null, 2))
}).catch(console.error)