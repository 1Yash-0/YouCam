#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.join(__dirname, '..')
const BASE_URL = 'http://localhost:3100'
const MAX_POLLS = 40
const POLL_INTERVAL = 3000 // 3 seconds
let serverPid = null

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
  if (body && !(body instanceof FormData)) {
    console.log('Body:', JSON.stringify(body, null, 2))
  }
  
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
    
    // Print raw POST body (truncated URLs) as requested
    if (data && typeof data === 'object') {
      const safeData = { ...data }
      
      // Truncate URLs to show first 50 chars only
      const truncateUrls = (obj) => {
        for (const key in obj) {
          if (typeof obj[key] === 'string' && (obj[key].includes('http') || obj[key].includes('s3'))) {
            obj[key] = obj[key].substring(0, 50) + '...'
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            truncateUrls(obj[key])
          }
        }
      }
      truncateUrls(safeData)
      
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

async function startServer() {
  console.log('Building and starting server...')
  
  // Build the project
  console.log('Running npm run build...')
  try {
    const { stdout, stderr } = await execAsync('npm run build', { cwd: WEB_ROOT })
    console.log('Build completed successfully')
  } catch (error) {
    console.error('Build failed:', error.message)
    throw error
  }
  
  // Start only the smoke-test child process; cleanup kills its entire tree.
  console.log('Starting server on port 3100...')
  const logDir = path.join(__dirname, '..', '..', 'outputs', 'b2')
  fs.mkdirSync(logDir, { recursive: true })
  const outLog = path.join(logDir, 'server.out.log')
  const errLog = path.join(logDir, 'server.err.log')
  fs.writeFileSync(outLog, '')
  fs.writeFileSync(errLog, '')
  const nextCli = path.join(WEB_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
  const child = spawn(process.execPath, [nextCli, 'start', '-p', '3100'], {
    cwd: WEB_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdout?.on('data', chunk => fs.appendFileSync(outLog, chunk))
  child.stderr?.on('data', chunk => fs.appendFileSync(errLog, chunk))
  serverPid = child.pid
  console.log(`Server started with PID: ${serverPid}`)
  
  // Wait for server to be ready
  console.log('Waiting for server to be ready...')
  let attempts = 0
  const maxAttempts = 20
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, { timeout: 2000 })
      if (response.status === 200) {
        console.log('Server is ready!')
        return
      }
    } catch (error) {
      // Server not ready yet
    }
    
    attempts++
    if (attempts < maxAttempts) {
      await sleep(2000)
      console.log(`Waiting... (${attempts}/${maxAttempts})`)
    }
  }
  
  throw new Error('Server failed to start within timeout')
}

async function stopServer() {
  if (!serverPid) {
    console.log('No server PID recorded, skipping stop')
    return
  }
  
  console.log(`\nStopping server (PID: ${serverPid})...`)
  try {
    if (process.platform === 'win32') {
      await execAsync(`taskkill /PID ${serverPid} /F /T`)
    } else {
      await execAsync(`kill ${serverPid}`)
    }
    console.log('Server stopped successfully')
  } catch (error) {
    console.error(`Error stopping server: ${error.message}`)
  }
}

async function killPorts() {
  console.log('Killing anything on ports 3000/3100...')
  try {
    if (process.platform === 'win32') {
      // Kill processes on port 3000
      await execAsync(`netstat -ano | findstr :3000`)
        .then(async (output) => {
          const lines = output.stdout.split('\n')
          for (const line of lines) {
            const match = line.match(/TCP.*:3000.*LISTENING\s+(\d+)/)
            if (match) {
              const pid = match[1]
              console.log(`Killing process ${pid} on port 3000`)
              await execAsync(`taskkill /PID ${pid} /F`)
            }
          }
        })
        .catch(() => {}) // No processes found
      
      // Kill processes on port 3100
      await execAsync(`netstat -ano | findstr :3100`)
        .then(async (output) => {
          const lines = output.stdout.split('\n')
          for (const line of lines) {
            const match = line.match(/TCP.*:3100.*LISTENING\s+(\d+)/)
            if (match) {
              const pid = match[1]
              console.log(`Killing process ${pid} on port 3100`)
              await execAsync(`taskkill /PID ${pid} /F`)
            }
          }
        })
        .catch(() => {}) // No processes found
    } else {
      // Linux/Mac
      await execAsync(`lsof -ti:3000 -ti:3100 | xargs kill -9 2>/dev/null || true`)
    }
    console.log('Ports cleared')
  } catch (error) {
    console.error('Error killing ports:', error.message)
  }
}

async function pollJob(jobId, endpoint = '/api/tryon') {
  console.log(`\nPolling job ${jobId}...`)
  let pollCount = 0
  
  while (pollCount < MAX_POLLS) {
    pollCount++
    console.log(`\nPoll ${pollCount}/${MAX_POLLS}...`)
    
    const jobStatus = await fetchWithLog('GET', `${endpoint}/${jobId}`)
    
    // Check response body status, not HTTP status
    if (jobStatus.data.status === 'done') {
      console.log('Job completed successfully')
      return jobStatus.data.result
    } else if (jobStatus.data.status === 'error') {
      throw new Error(`Job failed: ${jobStatus.data.code} - ${jobStatus.data.userMessage}`)
    } else if (jobStatus.data.status === 'running') {
      console.log('Status:', jobStatus.data.status)
      
      // Print step progress if available
      if (jobStatus.data.steps) {
        console.log('Steps progress:')
        jobStatus.data.steps.forEach((step, index) => {
          console.log(`  Step ${index + 1}: ${step.type} - ${step.status}`)
        })
      }
      
      if (pollCount < MAX_POLLS) {
        await sleep(POLL_INTERVAL)
      }
    } else {
      throw new Error(`Unexpected job status: ${jobStatus.data.status}`)
    }
  }
  
  throw new Error(`Job did not complete within ${MAX_POLLS} polls`)
}

async function downloadImage(imageUrl, outputPath) {
  try {
    console.log(`Downloading image from ${BASE_URL}${imageUrl}...`)
    const response = await fetch(`${BASE_URL}${imageUrl}`)
    if (!response.ok) {
      throw new Error(`Failed to download image: HTTP ${response.status}`)
    }
    
    const buffer = await response.arrayBuffer()
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    fs.writeFileSync(outputPath, Buffer.from(buffer))
    console.log(`Image saved to: ${outputPath}`)
    console.log(`File size: ${(buffer.byteLength / 1024).toFixed(1)} KB`)
    
    return true
  } catch (error) {
    console.error(`Failed to download image: ${error.message}`)
    return false
  }
}

async function main() {
  console.log('=== Youcam Try-On Smoke Test ===')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Current dir: ${process.cwd()}`)
  console.log(`Max budget: 5 units`)
  
  let photoId = null
  let balanceBefore = 0
  let balanceAfter = 0
  const results = []
  
  try {
    // First kill any processes on ports 3000/3100
    await killPorts()
    
    // Start server
    console.log('\n--- Step 0: Starting Server ---')
    await startServer()
    
    // 1. GET /api/health units before
    console.log('\n=== Step 1: Initial Health Check ===')
    const healthBefore = await fetchWithLog('GET', '/api/health')
    if (!healthBefore.data.ok) {
      throw new Error(`Health check failed: ${healthBefore.data.code}`)
    }
    balanceBefore = healthBefore.data.units
    console.log(`Units before: ${balanceBefore}`)
    
    // 2. POST /api/photo gen_face.png
    console.log('\n=== Step 2: Photo Upload ===')
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
    
    photoId = upload.data.photoId
    console.log(`Photo ID: ${photoId}`)
    
    // 3. POST /api/tryon basic earring
    console.log('\n=== Step 3: Basic Earring Try-On ===')
    const basicTryOnBody = {
      photoId,
      productId: 'gilded-teardrop',
      sizeCm: 3.0,
      ear: 'right',
      irisPx: 37
    }
    
    const basicTryOn = await fetchWithLog('POST', '/api/tryon', basicTryOnBody)
    let result1 = null
    
    // FIXED: Check response body status, not HTTP status
    if (basicTryOn.data.status === 'done') {
      result1 = basicTryOn.data.result
      console.log('Result returned immediately')
      console.log(`Steps: ${JSON.stringify(result1.steps)}`)
      console.log(`Units spent: ${result1.unitsSpent || result1.units || 0}`)
      console.log(`Measurement: ${JSON.stringify(result1.measurement)}`)
    } else if (basicTryOn.data.status === 'running') {
      console.log('Job created, polling...')
      result1 = await pollJob(basicTryOn.data.jobId)
      console.log(`Job completed.`)
      console.log(`Steps: ${JSON.stringify(result1.steps)}`)
      console.log(`Units spent: ${result1.unitsSpent || result1.units || 0}`)
      console.log(`Measurement: ${JSON.stringify(result1.measurement)}`)
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(basicTryOn.data)}`)
    }
    
    // Download result
    if (result1 && result1.imageUrl) {
      const outputPath = path.join(__dirname, '..', '..', 'outputs', 'b2', 'plain_3cm.png')
      await downloadImage(result1.imageUrl, outputPath)
      results.push({ step: 3, file: 'plain_3cm.png', success: true })
    }
    
    // 4. POST /api/tryon with lipstick (should poll)
    console.log('\n=== Step 4: Earring + Lipstick Try-On ===')
    const lipstickTryOnBody = {
      ...basicTryOnBody,
      options: {
        lipstick: {
          hex: '#9B1B30',
          texture: 'matte',
          intensity: 70
        }
      }
    }
    
    const lipstickTryOn = await fetchWithLog('POST', '/api/tryon', lipstickTryOnBody)
    let result2 = null
    
    if (lipstickTryOn.data.status === 'done') {
      result2 = lipstickTryOn.data.result
      console.log(`Immediate result.`)
      console.log(`Steps: ${JSON.stringify(result2.steps)}`)
      console.log(`Units spent: ${result2.unitsSpent || result2.units || 0}`)
    } else if (lipstickTryOn.data.status === 'running') {
      console.log('Job created, polling...')
      console.log('Polling responses:')
      
      // Custom polling to print step progress
      let pollCount = 0
      let finalResult = null
      
      while (pollCount < MAX_POLLS) {
        pollCount++
        const jobStatus = await fetchWithLog('GET', `/api/tryon/${lipstickTryOn.data.jobId}`)
        
        if (jobStatus.data.status === 'done') {
          finalResult = jobStatus.data.result
          console.log('Job completed successfully')
          break
        } else if (jobStatus.data.status === 'error') {
          throw new Error(`Job failed: ${jobStatus.data.code} - ${jobStatus.data.userMessage}`)
        } else if (jobStatus.data.status === 'running') {
          // Print step progress if available
          if (jobStatus.data.step && jobStatus.data.stepIndex !== undefined && jobStatus.data.totalSteps !== undefined) {
            console.log(`Poll ${pollCount}: step ${jobStatus.data.stepIndex + 1}/${jobStatus.data.totalSteps} (${jobStatus.data.step})`)
          } else if (jobStatus.data.steps) {
            console.log(`Poll ${pollCount}: steps in progress`)
            jobStatus.data.steps.forEach((step, index) => {
              console.log(`  Step ${index + 1}: ${step.type} - ${step.status}`)
            })
          } else {
            console.log(`Poll ${pollCount}: running`)
          }
          
          if (pollCount < MAX_POLLS) {
            await sleep(POLL_INTERVAL)
          }
        }
      }
      
      if (!finalResult) {
        throw new Error(`Job did not complete within ${MAX_POLLS} polls`)
      }
      
      result2 = finalResult
      console.log(`Final steps: ${JSON.stringify(result2.steps)}`)
      console.log(`Units spent: ${result2.unitsSpent || result2.units || 0}`)
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(lipstickTryOn.data)}`)
    }
    
    // Download result
    if (result2 && result2.imageUrl) {
      const outputPath = path.join(__dirname, '..', '..', 'outputs', 'b2', 'lip_earring.png')
      await downloadImage(result2.imageUrl, outputPath)
      results.push({ step: 4, file: 'lip_earring.png', success: true })
    }
    
    // 5. Repeat step 4 (should be cached)
    console.log('\n=== Step 5: Repeat Lipstick Try-On (Cached) ===')
    const lipstickTryOn2 = await fetchWithLog('POST', '/api/tryon', lipstickTryOnBody)
    
    if (lipstickTryOn2.data.status === 'done') {
      const result2d = lipstickTryOn2.data.result
      console.log(`Cached result.`)
      console.log(`Steps: ${JSON.stringify(result2d.steps)}`)
      console.log(`Units spent: ${result2d.unitsSpent || result2d.units || 0}`)
      
      // Verify it's cached (should be 0 units)
      const units = result2d.unitsSpent || result2d.units || 0
      if (units !== 0) {
        console.warn(`WARNING: Expected 0 units for cached result but got ${units}`)
      } else {
        console.log('✓ Correctly cached (0 units)')
      }
    } else {
      console.warn('WARNING: Expected immediate cache hit but got different response')
      console.log(`Response: ${JSON.stringify(lipstickTryOn2.data)}`)
    }
    
    // 6. POST /api/photo for front face, then POST /api/tryon necklace
    console.log('\n=== Step 6: Necklace Try-On ===')
    
    // Upload front face photo
    const frontPhotoPath = path.join(__dirname, '..', '..', 'outputs', 'probes', 'inputs', 'gen_face_front.png')
    
    if (!fs.existsSync(frontPhotoPath)) {
      throw new Error(`Front face photo not found: ${frontPhotoPath}`)
    }
    
    const frontPhotoBuffer = fs.readFileSync(frontPhotoPath)
    const frontFormData = new FormData()
    const frontBlob = new Blob([frontPhotoBuffer], { type: 'image/png' })
    frontFormData.append('photo', frontBlob, 'gen_face_front.png')
    
    const frontUpload = await fetchWithLog('POST', '/api/photo', frontFormData, {})
    if (frontUpload.status !== 200) {
      throw new Error(`Front photo upload failed: ${frontUpload.data.code}`)
    }
    
    const frontPhotoId = frontUpload.data.photoId
    console.log(`Front Photo ID: ${frontPhotoId}`)
    
    // Try necklace try-on
    const necklaceTryOnBody = {
      flow: 'neck',
      photoId: frontPhotoId,
      productId: 'orb-chain'
    }
    
    const necklaceTryOn = await fetchWithLog('POST', '/api/tryon', necklaceTryOnBody)
    let result3 = null
    
    if (necklaceTryOn.data.status === 'done') {
      result3 = necklaceTryOn.data.result
      console.log(`Immediate result.`)
      console.log(`Steps: ${JSON.stringify(result3.steps)}`)
      console.log(`Units spent: ${result3.unitsSpent || result3.units || 0}`)
    } else if (necklaceTryOn.data.status === 'running') {
      console.log('Job created, polling...')
      result3 = await pollJob(necklaceTryOn.data.jobId)
      console.log(`Job completed.`)
      console.log(`Steps: ${JSON.stringify(result3.steps)}`)
      console.log(`Units spent: ${result3.unitsSpent || result3.units || 0}`)
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(necklaceTryOn.data)}`)
    }
    
    // Download result
    if (result3 && result3.imageUrl) {
      const outputPath = path.join(__dirname, '..', '..', 'outputs', 'b2', 'necklace.png')
      await downloadImage(result3.imageUrl, outputPath)
      results.push({ step: 6, file: 'necklace.png', success: true })
    }
    
    // 7. GET /api/health units after
    console.log('\n=== Step 7: Final Health Check ===')
    const healthAfter = await fetchWithLog('GET', '/api/health')
    if (!healthAfter.data.ok) {
      throw new Error(`Final health check failed: ${healthAfter.data.code}`)
    }
    balanceAfter = healthAfter.data.units
    console.log(`Units before: ${balanceBefore}`)
    console.log(`Units after: ${balanceAfter}`)
    const unitsSpent = balanceBefore - balanceAfter
    console.log(`Units spent: ${unitsSpent}`)
    console.log(`Budget limit: 5 units`)
    
    if (unitsSpent > 5) {
      throw new Error(`Exceeded budget! Spent ${unitsSpent} units, limit is 5`)
    }
    
    // Check output files
    console.log('\n=== Checking Generated Files ===')
    const outputDir = path.join(__dirname, '..', '..', 'outputs', 'b2')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    const filesToCheck = [
      'plain_3cm.png',
      'lip_earring.png', 
      'necklace.png'
    ]
    
    for (const filename of filesToCheck) {
      const filepath = path.join(outputDir, filename)
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath)
        console.log(`✓ ${filename}: ${(stats.size / 1024).toFixed(1)} KB`)
      } else {
        console.log(`✗ ${filename}: NOT FOUND`)
      }
    }
    
    // Final summary
    console.log('\n=== Smoke Test Summary ===')
    console.log(`Steps completed: ${results.length}/6`)
    console.log(`Units spent: ${unitsSpent}/5 (${unitsSpent <= 5 ? 'WITHIN BUDGET' : 'OVER BUDGET'})`)
    console.log(`Server PID: ${serverPid}`)
    
    if (unitsSpent <= 5 && results.length === 3) {
      console.log('\n=== Smoke Test PASSED ===')
    } else {
      console.log('\n=== Smoke Test FAILED ===')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('\n=== Smoke Test FAILED ===')
    console.error(`Error: ${error.message}`)
    console.error(error.stack)
    
    // Check for logs if steps 4 or 6 failed
    if (error.message.includes('Step 4') || error.message.includes('Step 6') || 
        error.message.includes('lipstick') || error.message.includes('necklace')) {
      console.log('\n=== Checking Server Logs ===')
      
      const logsDir = path.join(__dirname, '..', '..', 'outputs', 'b2')
      const errLog = path.join(logsDir, 'server.err.log')
      const outLog = path.join(logsDir, 'server.out.log')
      
      if (fs.existsSync(errLog)) {
        console.log(`\nLast 40 lines of ${errLog}:`)
        const errContent = fs.readFileSync(errLog, 'utf8')
        const errLines = errContent.split('\n')
        console.log(errLines.slice(-40).join('\n'))
      }
      
      if (fs.existsSync(outLog)) {
        console.log(`\nLast 40 lines of ${outLog}:`)
        const outContent = fs.readFileSync(outLog, 'utf8')
        const outLines = outContent.split('\n')
        console.log(outLines.slice(-40).join('\n'))
      }
    }
    
    process.exit(1)
  } finally {
    // Always stop the server
    await stopServer()
  }
}

// Run the test
main()