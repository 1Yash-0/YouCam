#!/usr/bin/env node

import { upload, runTask, saveProbeResults, getCreditBalance } from './lib.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '../../..')

async function main() {
  console.log('=== P5: Skin Tone Analysis Probe ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Upload source face image
  const facePath = path.join(ROOT_DIR, 'outputs/b0/inputs/gen_face.png')
  const srcFileId = await upload(facePath)
  console.log(`Uploaded face: ${srcFileId}`)
  
  // According to docs: POST /s2s/v2.0/task/skin-tone-analysis {src_file_id}
  const requestBody = {
    src_file_id: srcFileId
  }
  
  console.log('Request body:', JSON.stringify(requestBody, null, 2))
  
  try {
    // Run the skin tone analysis task
    const result = await runTask('/s2s/v2.0/task/skin-tone-analysis', requestBody)
    
    // Get ending balance
    const endBalance = await getCreditBalance()
    const unitsUsed = startBalance - endBalance
    
    console.log(`Task completed in ${result.elapsedSeconds.toFixed(1)}s`)
    console.log(`Units used: ${unitsUsed}`)
    console.log(`Ending balance: ${endBalance} units`)
    
    // Save results
    saveProbeResults('p5-skin-tone', requestBody, result, result.elapsedSeconds)
    
    // Extract and display the analysis results
    const analysisResults = result.data?.data?.results
    if (analysisResults) {
      console.log('\n=== Skin Tone Analysis Results ===')
      console.log(JSON.stringify(analysisResults, null, 2))
    }
    
    return {
      success: true,
      requestBody,
      unitsUsed,
      elapsedSeconds: result.elapsedSeconds,
      resultStatus: result.data?.data?.task_status,
      analysisResults
    }
    
  } catch (error) {
    console.error(`P5 failed: ${error.message}`)
    
    // Save error results
    const errorResult = {
      status: 500,
      data: { error: error.message }
    }
    saveProbeResults('p5-skin-tone-error', requestBody, errorResult, 0)
    
    return {
      success: false,
      error: error.message,
      requestBody
    }
  }
}

main().then(result => {
  console.log('\n=== P5 Summary ===')
  console.log(JSON.stringify(result, null, 2))
}).catch(console.error)