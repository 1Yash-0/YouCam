#!/usr/bin/env node

import { upload, runTask, saveProbeResults, getCreditBalance } from './lib.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '../../..')

async function main() {
  console.log('=== P3: Lipstick Probe ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Upload source face image
  const facePath = path.join(ROOT_DIR, 'outputs/b0/inputs/gen_face.png')
  const srcFileId = await upload(facePath)
  console.log(`Uploaded face: ${srcFileId}`)
  
  // Based on documentation and example in instructions
  const requestBody = {
    src_file_id: srcFileId,
    version: '1.0',
    effects: [
      {
        category: 'skin_smooth',
        skinSmoothStrength: 0,
        skinSmoothColorIntensity: 0
      },
      {
        category: 'lip_color',
        shape: { name: 'original' },
        morphology: { fullness: 50, wrinkless: 50 },
        palettes: [
          { color: '#9B1B30', texture: 'matte', colorIntensity: 70 }
        ],
        style: { type: 'full' }
      }
    ]
  }
  
  console.log('Request body:', JSON.stringify(requestBody, null, 2))
  
  try {
    // Run the makeup VTO task
    const result = await runTask('/s2s/v2.0/task/makeup-vto', requestBody)
    
    // Get ending balance
    const endBalance = await getCreditBalance()
    const unitsUsed = startBalance - endBalance
    
    console.log(`Task completed in ${result.elapsedSeconds.toFixed(1)}s`)
    console.log(`Units used: ${unitsUsed}`)
    console.log(`Ending balance: ${endBalance} units`)
    
    // Save results
    saveProbeResults('p3-lipstick', requestBody, result, result.elapsedSeconds, result.resultImageUrl)
    
    return {
      success: true,
      requestBody,
      unitsUsed,
      elapsedSeconds: result.elapsedSeconds,
      resultStatus: result.data?.data?.task_status,
      resultImageUrl: result.resultImageUrl ? result.resultImageUrl.substring(0, 50) + '...' : null
    }
    
  } catch (error) {
    console.error(`P3 failed: ${error.message}`)
    
    // Try with adjusted body if it's a 400 error
    if (error.message.includes('400')) {
      console.log('Trying with adjusted body...')
      
      // Adjust based on common issues - maybe remove skin_smooth or adjust parameters
      const adjustedBody = {
        src_file_id: srcFileId,
        version: '1.0',
        effects: [
          {
            category: 'lip_color',
            shape: { name: 'original' },
            morphology: { fullness: 50, wrinkle: 50 }, // Note: "wrinkle" not "wrinkless"?
            palettes: [
              { color: '#9B1B30', texture: 'matte', colorIntensity: 70 }
            ],
            style: { type: 'full' }
          }
        ]
      }
      
      console.log('Adjusted request body:', JSON.stringify(adjustedBody, null, 2))
      
      try {
        const retryResult = await runTask('/s2s/v2.0/task/makeup-vto', adjustedBody)
        
        const endBalance = await getCreditBalance()
        const unitsUsed = startBalance - endBalance
        
        console.log(`Retry completed in ${retryResult.elapsedSeconds.toFixed(1)}s`)
        console.log(`Units used: ${unitsUsed}`)
        console.log(`Ending balance: ${endBalance} units`)
        
        saveProbeResults('p3-lipstick-retry', adjustedBody, retryResult, retryResult.elapsedSeconds, retryResult.resultImageUrl)
        
        return {
          success: true,
          requestBody: adjustedBody,
          unitsUsed,
          elapsedSeconds: retryResult.elapsedSeconds,
          resultStatus: retryResult.data?.data?.task_status,
          resultImageUrl: retryResult.resultImageUrl ? retryResult.resultImageUrl.substring(0, 50) + '...' : null
        }
        
      } catch (retryError) {
        console.error(`Retry also failed: ${retryError.message}`)
        
        // Save error results
        const errorResult = {
          status: 500,
          data: { error: retryError.message }
        }
        saveProbeResults('p3-lipstick-error', adjustedBody, errorResult, 0)
        
        return {
          success: false,
          error: retryError.message,
          requestBody: adjustedBody
        }
      }
    } else {
      // Save error results
      const errorResult = {
        status: 500,
        data: { error: error.message }
      }
      saveProbeResults('p3-lipstick-error', requestBody, errorResult, 0)
      
      return {
        success: false,
        error: error.message,
        requestBody
      }
    }
  }
}

main().then(result => {
  console.log('\n=== P3 Summary ===')
  console.log(JSON.stringify(result, null, 2))
}).catch(console.error)