#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '../../..')

// Load API key from .env.local
function loadApiKey() {
  const envPath = path.join(ROOT_DIR, '.env.local')
  const content = fs.readFileSync(envPath, 'utf8')
  const lines = content.split('\n')
  for (const line of lines) {
    if (line.startsWith('YOUCAM_API_KEY=')) {
      return line.replace('YOUCAM_API_KEY=', '').trim()
    }
  }
  throw new Error('YOUCAM_API_KEY not found in .env.local')
}

function loadApiBase() {
  const envPath = path.join(ROOT_DIR, '.env.local')
  const content = fs.readFileSync(envPath, 'utf8')
  const lines = content.split('\n')
  for (const line of lines) {
    if (line.startsWith('YOUCAM_API_BASE=')) {
      return line.replace('YOUCAM_API_BASE=', '').trim()
    }
  }
  return 'https://yce-api-01.makeupar.com'
}

const API_KEY = loadApiKey()
const API_BASE = loadApiBase()

// Ensure output directories exist
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs', 'probes')
const INPUTS_DIR = path.join(OUTPUTS_DIR, 'inputs')
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true })
if (!fs.existsSync(INPUTS_DIR)) fs.mkdirSync(INPUTS_DIR, { recursive: true })

// Helper: generic API request
export async function request(method, endpoint, body = null, headers = {}) {
  const url = `${API_BASE}${endpoint}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
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
  
  console.log(`${method} ${endpoint}`)
  
  const response = await fetch(url, options)
  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  
  console.log(`Status: ${response.status}`)
  
  return {
    status: response.status,
    data,
    headers: Object.fromEntries(response.headers.entries())
  }
}

// Helper: upload file via File API
export async function upload(filePath, contentType = 'image/png') {
  const stats = fs.statSync(filePath)
  const fileName = path.basename(filePath)
  const fileSize = stats.size
  
  const body = {
    files: [{
      content_type: contentType,
      file_name: fileName,
      file_size: fileSize
    }]
  }
  
  const result = await request('POST', '/s2s/v2.0/file', body)
  
  if (result.status !== 200 || !result.data?.data?.files?.[0]?.requests?.[0]?.url) {
    throw new Error(`File upload failed: ${JSON.stringify(result.data)}`)
  }
  
  const uploadUrl = result.data.data.files[0].requests[0].url
  const fileId = result.data.data.files[0].file_id
  
  // Read file bytes
  const fileBytes = fs.readFileSync(filePath)
  
  // PUT the bytes with the returned headers
  const headers = {}
  for (const [key, value] of Object.entries(result.data.data.files[0].requests[0].headers || {})) {
    headers[key] = value
  }
  
  console.log(`PUT ${uploadUrl.substring(0, 50)}...`)
  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    body: fileBytes
  })
  
  if (!putResponse.ok) {
    throw new Error(`PUT failed: ${putResponse.status} ${await putResponse.text()}`)
  }
  
  console.log(`Uploaded ${fileName} -> file_id: ${fileId}`)
  return fileId
}

// Helper: run task with polling
export async function runTask(taskPath, body, maxPollSeconds = 60) {
  const startTime = Date.now()
  const result = await request('POST', taskPath, body)
  
  if (result.status !== 200 || !result.data?.data?.task_id) {
    throw new Error(`Task creation failed: ${JSON.stringify(result.data)}`)
  }
  
  const taskId = result.data.data.task_id
  console.log(`Task created: ${taskId}`)
  
  const maxPolls = Math.floor(maxPollSeconds / 3)
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const pollResult = await request('GET', `${taskPath}/${taskId}`)
    
    if (pollResult.status !== 200) {
      throw new Error(`Poll failed: ${JSON.stringify(pollResult.data)}`)
    }
    
    // Try different possible status field locations
    const status = pollResult.data?.data?.task_status || pollResult.data?.data?.status || pollResult.data?.status
    console.log(`Poll ${i + 1}/${maxPolls}: ${status}`)
    
    if (status === 'completed' || status === 'failed' || status === 'error' || status === 'success') {
      const elapsedSeconds = (Date.now() - startTime) / 1000
      
      // Extract result image URL if available
      let resultImageUrl = null
      if (pollResult.data?.data?.results?.url) {
        resultImageUrl = pollResult.data.data.results.url
      } else if (pollResult.data?.data?.result_image_urls?.[0]) {
        resultImageUrl = pollResult.data.data.result_image_urls[0]
      }
      
      return {
        ...pollResult,
        elapsedSeconds,
        taskId,
        resultImageUrl
      }
    }
  }
  
  throw new Error(`Task ${taskId} timed out after ${maxPollSeconds} seconds`)
}

// Helper: save probe results
export function saveProbeResults(name, requestBody, response, elapsedSeconds, resultImageUrl = null) {
  const safeBody = { ...requestBody }
  // Remove any potential key leaks
  if (safeBody.Authorization) delete safeBody.Authorization
  if (safeBody.headers?.Authorization) delete safeBody.headers.Authorization
  
  const resultPath = path.join(OUTPUTS_DIR, `${name}.json`)
  const result = {
    timestamp: new Date().toISOString(),
    request: safeBody,
    response: {
      status: response.status,
      data: response.data,
      // Truncate long URLs in response
      truncated: response.data?.data?.result_image_urls ? 
        response.data.data.result_image_urls.map(url => url.substring(0, 50) + '...') : 
        undefined
    },
    elapsedSeconds
  }
  
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2))
  console.log(`Saved results to ${resultPath}`)
  
  // Download result image if available
  if (resultImageUrl) {
    const ext = resultImageUrl.includes('.jpg') || resultImageUrl.includes('.jpeg') ? 'jpg' : 'png'
    const imagePath = path.join(OUTPUTS_DIR, `${name}.${ext}`)
    
    fetch(resultImageUrl)
      .then(res => res.arrayBuffer())
      .then(buffer => {
        fs.writeFileSync(imagePath, Buffer.from(buffer))
        console.log(`Downloaded image to ${imagePath}`)
      })
      .catch(err => {
        console.error(`Failed to download image: ${err.message}`)
      })
  }
}

// Helper: get credit balance
export async function getCreditBalance() {
  const result = await request('GET', '/s2s/v1.0/client/credit')
  if (result.status === 200 && result.data?.results) {
    // Sum all available credit amounts
    const totalCredit = result.data.results.reduce((sum, token) => sum + token.amount_dec, 0)
    return totalCredit
  }
  throw new Error(`Failed to get credit balance: ${JSON.stringify(result.data)}`)
}