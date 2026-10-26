#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'http://localhost:3000'
const MAX_POLLS = 40
const POLL_INTERVAL = 3000 // 3 seconds

async function fetchWithLog(method, endpoint, body = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }
  
  if (body) {
    if (body instanceof FormData) {
      delete options.headers['Content-Type']
      options.body = body
    } else {
      options.body = JSON.stringify(body)
    }
  }
  
  console.log(`\n${method} ${endpoint}`)
  
  try {
    const response = await fetch(url, options)
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
    
    console.log(`Status: ${response.status}`)
    
    // Redact sensitive information
    if (data && typeof data === 'object') {
      const safeData = { ...data }
      if (safeData.imageUrl && safeData.imageUrl.includes('s3')) {
        safeData.imageUrl = safeData.imageUrl.substring(0, 50) + '...'
      }
      if (safeData.renderedUrl && safeData.renderedUrl.includes('s3')) {
        safeData.renderedUrl = safeData.renderedUrl.substring(0, 50) + '...'
      }
      console.log('Response:', JSON.stringify(safeData, null, 2))
    } else if (typeof data === 'string' && data.length > 100) {
      console.log('Response:', data.substring(0, 100) + '...')
    } else {
      console.log('Response:', data)
    }
    
    return { status: response.status, data, headers: response.headers }
  } catch (error) {
    console.log(`Error: ${error.message}`)
    throw error
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('=== Darpan Smoke Test ===')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Current dir: ${process.cwd()}`)
  
  try {
    // 1. Check health
    console.log('\n--- Step 1: Health Check ---')
    const health = await fetchWithLog('GET', '/api/health')
    if (!health.data.ok) {
      throw new Error(`Health check failed: ${health.data.code}`)
    }
    const balanceBefore = health.data.units
    console.log(`Balance before: ${balanceBefore} units`)
    
    // 2. Upload photo
    console.log('\n--- Step 2: Photo Upload ---')
    const photoPath = path.join(__dirname, '..', '..', 'outputs', 'b0', 'inputs', 'gen_face.png')
    
    if (!fs.existsSync(photoPath)) {
      throw new Error(`Test photo not found: ${photoPath}`)
    }
    
    const photoBuffer = fs.readFileSync(photoPath)
    const formData = new FormData()
    const blob = new Blob([photoBuffer], { type: 'image/png' })
    formData.append('photo', blob, 'gen_face.png')
    
    const upload = await fetchWithLog('POST', '/api/photo', formData, {})
    if (upload.status !== 200) {
      throw new Error(`Photo upload failed: ${upload.data.code}`)
    }
    
    const photoId = upload.data.photoId
    console.log(`Photo ID: ${photoId}`)
    
    // 3. Measure iris width (estimate from image)
    console.log('\n--- Step 3: Iris Measurement ---')
    // The test image has eyes around y~480. Let's estimate iris width.
    // Based on visual inspection of gen_face.png, the iris appears to be
    // approximately 35-40 pixels wide horizontally.
    const irisPx = 37 // Estimated from visual inspection
    console.log(`Estimated iris width: ${irisPx} pixels`)
    console.log('Note: This is an estimate for testing. In production, use MediaPipe for accurate measurement.')
    
    // 4. Create try-on job
    console.log('\n--- Step 4: Create Try-On Job ---')
    const tryOnBody = {
      photoId,
      productId: 'gilded-teardrop',
      sizeCm: 3.0,
      ear: 'right',
      irisPx,
    }
    
    const tryOnCreate = await fetchWithLog('POST', '/api/tryon', tryOnBody)
    
    let jobId, result
    
    if (tryOnCreate.data.status === 'done') {
      // Immediate cache hit
      console.log('CACHE HIT! Result returned immediately (0 units)')
      result = tryOnCreate.data.result
    } else if (tryOnCreate.data.status === 'running') {
      jobId = tryOnCreate.data.jobId
      console.log(`Job created: ${jobId}`)
      
      // 5. Poll for completion
      console.log('\n--- Step 5: Poll Job Status ---')
      let pollCount = 0
      let jobStatus
      
      while (pollCount < MAX_POLLS) {
        pollCount++
        console.log(`\nPoll ${pollCount}/${MAX_POLLS}...`)
        
        jobStatus = await fetchWithLog('GET', `/api/tryon/${jobId}`)
        
        if (jobStatus.data.status === 'done') {
          result = jobStatus.data.result
          console.log('Job completed successfully')
          break
        } else if (jobStatus.data.status === 'error') {
          throw new Error(`Job failed: ${jobStatus.data.code} - ${jobStatus.data.userMessage}`)
        } else if (jobStatus.data.status === 'running') {
          console.log('Still running, waiting...')
          if (pollCount < MAX_POLLS) {
            await sleep(POLL_INTERVAL)
          }
        }
      }
      
      if (!result) {
        throw new Error(`Job did not complete within ${MAX_POLLS} polls`)
      }
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(tryOnCreate.data)}`)
    }
    
    console.log('\n--- Step 6: Verify Result ---')
    console.log('Result key:', result.key)
    console.log('Units spent:', result.units)
    console.log('Cached:', result.cached)
    console.log('Measurement:', JSON.stringify(result.measurement, null, 2))
    
    // 7. Test cache hit
    console.log('\n--- Step 7: Test Cache Hit ---')
    const cacheTest = await fetchWithLog('POST', '/api/tryon', tryOnBody)
    if (cacheTest.data.status !== 'done' || !cacheTest.data.result.cached) {
      throw new Error('Cache hit test failed')
    }
    console.log('Cache hit successful (0 units)')
    
    // 8. Download result image
    console.log('\n--- Step 8: Download Result Image ---')
    const imageResponse = await fetch(`${BASE_URL}${result.imageUrl}`)
    if (imageResponse.status !== 200) {
      throw new Error(`Failed to download result image: ${imageResponse.status}`)
    }
    
    const imageBuffer = await imageResponse.arrayBuffer()
    const outputDir = path.join(__dirname, '..', '..', 'outputs', 'b1')
    fs.mkdirSync(outputDir, { recursive: true })
    
    const outputPath = path.join(outputDir, 'smoke_3cm.png')
    fs.writeFileSync(outputPath, Buffer.from(imageBuffer))
    console.log(`Result image saved to: ${outputPath}`)
    console.log(`File size: ${(imageBuffer.byteLength / 1024).toFixed(1)} KB`)
    
    // 9. Final health check
    console.log('\n--- Step 9: Final Health Check ---')
    const finalHealth = await fetchWithLog('GET', '/api/health')
    const balanceAfter = finalHealth.data.units
    
    const unitsSpent = balanceBefore - balanceAfter
    console.log(`Balance before: ${balanceBefore} units`)
    console.log(`Balance after: ${balanceAfter} units`)
    console.log(`Units spent: ${unitsSpent} units`)
    
    if (unitsSpent !== 1) {
      console.warn(`WARNING: Expected 1 unit spent, got ${unitsSpent}`)
    }
    
    console.log('\n=== Smoke Test PASSED ===')
    console.log(`Expected spend: 1 unit (actual: ${unitsSpent})`)
    console.log(`Result saved: ${outputPath}`)
    
  } catch (error) {
    console.error('\n=== Smoke Test FAILED ===')
    console.error(`Error: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

// Start the server first if not running
async function startServerIfNeeded() {
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/health`, { timeout: 2000 })
    if (healthCheck.status === 200) {
      console.log('Server is already running')
      return
    }
  } catch {
    // Server not running
  }
  
  console.log('Starting server...')
  console.log('Please run the server in a separate terminal:')
  console.log('  cd web && npm run build && npm start')
  console.log('\nThen run this script again.')
  process.exit(1)
}

// Check if we should start the server
if (process.argv.includes('--start-server')) {
  // In a real implementation, we would start the server here
  // For now, just prompt the user to start it manually
  startServerIfNeeded()
} else {
  main()
}