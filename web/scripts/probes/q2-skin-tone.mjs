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
  console.log('=== Q2: SKIN TONE ANALYSIS ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Check if we should skip Q2 based on Q1+Q3+Q4 > 6 units
  // For now, we'll run it since we haven't run Q3 or Q4 yet
  
  // Step 1: Upload the front-facing face image generated in Q1
  console.log('\n--- Step 1: Upload front-facing face image ---')
  const facePath = path.join(INPUTS_DIR, 'gen_face_front.png')
  if (!fs.existsSync(facePath)) {
    throw new Error(`Front-facing face image not found at ${facePath}`)
  }
  
  const srcFileId = await upload(facePath)
  console.log(`Uploaded front-facing face: ${srcFileId}`)
  
  // Step 2: Run skin tone analysis task
  console.log('\n--- Step 2: Run skin tone analysis ---')
  // According to docs: POST /s2s/v2.0/task/skin-tone-analysis
  const requestBody = {
    src_file_id: srcFileId
    // Note: The docs may allow face_angle_strictness_level, but we keep default
  }
  
  console.log('Skin tone analysis request:', JSON.stringify(requestBody, null, 2))
  
  try {
    const result = await runTask('/s2s/v2.0/task/skin-tone-analysis', requestBody)
    
    // Save full results JSON
    const resultPath = path.join(OUTPUTS_DIR, 'q2-skin-tone.json')
    const resultData = {
      request: requestBody,
      response: result.data,
      taskId: result.taskId,
      elapsedSeconds: result.elapsedSeconds
    }
    
    fs.writeFileSync(resultPath, JSON.stringify(resultData, null, 2))
    console.log(`\nFull results saved to: ${resultPath}`)
    
    // Get final balance
    const finalBalance = await getCreditBalance()
    const unitsUsed = startBalance - finalBalance
    
    console.log(`\n--- Q2 Results ---`)
    console.log(`Skin tone analysis completed in ${result.elapsedSeconds.toFixed(1)}s`)
    console.log(`Units used: ${unitsUsed}`)
    console.log(`Ending balance: ${finalBalance} units`)
    
    // Display key results
    const analysisResults = result.data?.data?.results
    if (analysisResults && analysisResults.length > 0) {
      console.log(`\n=== Skin Tone Analysis Summary ===`)
      analysisResults.forEach((result, index) => {
        console.log(`Face ${index + 1}:`)
        console.log(`  Skin tone: ${result.skin_tone}`)
        console.log(`  Skin tone code: ${result.skin_tone_code}`)
        console.log(`  Confidence: ${result.confidence}`)
        if (result.face_location) {
          console.log(`  Face location: x=${result.face_location.x}, y=${result.face_location.y}, w=${result.face_location.w}, h=${result.face_location.h}`)
        }
      })
    }
    
    return {
      success: true,
      srcFileId,
      resultPath,
      unitsUsed,
      analysisResults
    }
    
  } catch (error) {
    console.error(`\nSkin tone analysis failed: ${error.message}`)
    
    // Save error results
    const errorPath = path.join(OUTPUTS_DIR, 'q2-skin-tone-error.json')
    const errorData = {
      request: requestBody,
      error: error.message,
      timestamp: new Date().toISOString()
    }
    
    fs.writeFileSync(errorPath, JSON.stringify(errorData, null, 2))
    console.log(`Error details saved to: ${errorPath}`)
    
    throw error
  }
}

main().catch(error => {
  console.error(`\nQ2 failed: ${error.message}`)
  process.exit(1)
})