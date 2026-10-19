#!/usr/bin/env node

import { upload, runTask, saveProbeResults, getCreditBalance, request } from './lib.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '../../..')
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs', 'probes')
const INPUTS_DIR = path.join(OUTPUTS_DIR, 'inputs')

// Helper to resize image using sharp (from web/node_modules)
async function resizeImage(inputPath, outputPath, maxDimension) {
  try {
    // Try to import sharp from web/node_modules
    const sharpPath = path.join(ROOT_DIR, 'web', 'node_modules', 'sharp')
    const sharp = await import(sharpPath)
    
    const image = sharp.default(inputPath)
    const metadata = await image.metadata()
    
    let width, height
    if (metadata.width > metadata.height) {
      // Landscape
      if (metadata.width > maxDimension) {
        width = maxDimension
        height = Math.round((metadata.height / metadata.width) * maxDimension)
      } else {
        width = metadata.width
        height = metadata.height
      }
    } else {
      // Portrait
      if (metadata.height > maxDimension) {
        height = maxDimension
        width = Math.round((metadata.width / metadata.height) * maxDimension)
      } else {
        width = metadata.width
        height = metadata.height
      }
    }
    
    await image.resize(width, height).toFile(outputPath)
    console.log(`Resized ${metadata.width}x${metadata.height} to ${width}x${height}`)
    return { width, height }
  } catch (error) {
    console.warn(`Could not resize with sharp: ${error.message}. Using original image.`)
    // Copy original file
    fs.copyFileSync(inputPath, outputPath)
    return null
  }
}

async function main() {
  console.log('=== P4: Hairstyle Probe ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Step 1: Get hair template list
  console.log('\n--- Step 1: Get hair template list ---')
  const templates = []
  let startingToken = null
  const pageSize = 20
  const maxPages = 5
  let pagesFetched = 0
  
  while (pagesFetched < maxPages) {
    pagesFetched++
    console.log(`Fetching page ${pagesFetched}...`)
    
    let url = `/s2s/v2.1/task/template/hair-transfer?page_size=${pageSize}`
    if (startingToken) {
      url += `&starting_token=${startingToken}`
    }
    
    const result = await request('GET', url)
    
    if (result.status !== 200 || !result.data?.data?.templates) {
      console.error(`Failed to get templates page ${pagesFetched}:`, result.data)
      break
    }
    
    const pageTemplates = result.data.data.templates
    templates.push(...pageTemplates)
    
    console.log(`Got ${pageTemplates.length} templates on page ${pagesFetched}`)
    
    // Check if there's a next token
    startingToken = result.data.data.next_token
    if (!startingToken || pageTemplates.length === 0) {
      console.log(`Reached end of templates`)
      break
    }
  }
  
  console.log(`Total templates fetched: ${templates.length}`)
  
  // Save templates to file
  const templatesPath = path.join(OUTPUTS_DIR, 'hair_templates.json')
  fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2))
  console.log(`Saved templates to ${templatesPath}`)
  
  // Find updos/buns/ponytails
  const updos = templates.filter(t => {
    const title = t.title?.toLowerCase() || ''
    return title.includes('updo') || title.includes('bun') || title.includes('ponytail') || 
           title.includes('tied') || title.includes('back') || title.includes('up')
  })
  
  console.log(`\nFound ${updos.length} updo candidates:`)
  updos.forEach(t => {
    console.log(`  - ${t.id}: ${t.title} (keep color: ${t.keep_user_color || 'unknown'})`)
  })
  
  // Step 2: Generate hair-down face image
  console.log('\n--- Step 2: Generate hair-down face image ---')
  const textToImageBody = {
    model: 'youcam-image-v2',
    prompt: 'photorealistic studio portrait of a young woman, head turned 35 degrees to her left, long loose straight hair down covering her ears, neutral grey background, soft even lighting, sharp focus, chest-up',
    negative_prompt: 'blurry, low quality, distorted, watermark, text, makeup, jewelry',
    size: '1104*1472',
    prompt_extend: true
  }
  
  console.log('Text-to-image request for hair-down face...')
  const textToImageResult = await runTask('/s2s/v2.0/task/text-to-image/youcam', textToImageBody)
  
  if (!textToImageResult.resultImageUrl) {
    throw new Error('No result image URL from text-to-image generation')
  }
  
  // Download the generated face image
  const faceImagePath = path.join(INPUTS_DIR, 'gen_face_hairdown.png')
  const imageResponse = await fetch(textToImageResult.resultImageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`)
  }
  
  const imageBuffer = await imageResponse.arrayBuffer()
  fs.writeFileSync(faceImagePath, Buffer.from(imageBuffer))
  console.log(`Generated hair-down face saved to: ${faceImagePath}`)
  
  // Resize image if needed (JPG only, long side <= 1024)
  const resizedPath = path.join(INPUTS_DIR, 'gen_face_hairdown_resized.jpg')
  const resizeInfo = await resizeImage(faceImagePath, resizedPath, 1024)
  console.log(`Resized image saved to: ${resizedPath}`)
  
  // Get intermediate balance after text-to-image
  const intermediateBalance = await getCreditBalance()
  const textToImageUnits = startBalance - intermediateBalance
  console.log(`Text-to-image units used: ${textToImageUnits}`)
  
  // Step 3: Upload resized face image
  console.log('\n--- Step 3: Upload resized face image ---')
  const srcFileId = await upload(resizedPath, 'image/jpeg')
  console.log(`Uploaded face: ${srcFileId}`)
  
  // Step 4: Run hairstyle transfer with best updo template
  console.log('\n--- Step 4: Run hairstyle transfer ---')
  if (updos.length === 0) {
    console.warn('No updo templates found, using first template')
  }
  
  const template = updos[0] || templates[0]
  console.log(`Using template: ${template.id} - ${template.title}`)
  
  // According to docs: use preset mode to keep user's hair color
  const hairstyleRequestBody = {
    src_file_id: srcFileId,
    template_id: template.id,
    mode: 'preset', // preset mode should keep user's hair color
    parameter: {
      hair_color_intensity: 100, // Full intensity for natural color
      hair_transfer_strength: 100
    }
  }
  
  console.log('Hairstyle request:', JSON.stringify(hairstyleRequestBody, null, 2))
  
  const hairstyleResult = await runTask('/s2s/v2.1/task/hair-transfer', hairstyleRequestBody)
  
  // Get final balance
  const finalBalance = await getCreditBalance()
  const hairstyleUnits = intermediateBalance - finalBalance
  const totalUnits = textToImageUnits + hairstyleUnits
  
  console.log(`\n--- P4 Results ---`)
  console.log(`Text-to-image completed in ${textToImageResult.elapsedSeconds.toFixed(1)}s`)
  console.log(`Hairstyle transfer completed in ${hairstyleResult.elapsedSeconds.toFixed(1)}s`)
  console.log(`Text-to-image units: ${textToImageUnits}`)
  console.log(`Hairstyle transfer units: ${hairstyleUnits}`)
  console.log(`Total units used: ${totalUnits}`)
  console.log(`Final balance: ${finalBalance} units`)
  
  // Save results
  saveProbeResults('p4-text-to-image-face', textToImageBody, textToImageResult, textToImageResult.elapsedSeconds, textToImageResult.resultImageUrl)
  saveProbeResults('p4-hairstyle', hairstyleRequestBody, hairstyleResult, hairstyleResult.elapsedSeconds, hairstyleResult.resultImageUrl)
  
  return {
    success: true,
    templates: {
      total: templates.length,
      updos: updos.length,
      candidates: updos.map(t => ({
        id: t.id,
        title: t.title,
        keepColor: t.keep_user_color
      }))
    },
    textToImage: {
      requestBody: textToImageBody,
      unitsUsed: textToImageUnits,
      elapsedSeconds: textToImageResult.elapsedSeconds,
      savedPath: faceImagePath,
      resizedPath: resizedPath
    },
    hairstyle: {
      requestBody: hairstyleRequestBody,
      unitsUsed: hairstyleUnits,
      elapsedSeconds: hairstyleResult.elapsedSeconds,
      templateUsed: `${template.id} - ${template.title}`,
      resultImageUrl: hairstyleResult.resultImageUrl ? hairstyleResult.resultImageUrl.substring(0, 50) + '...' : null
    },
    totalUnits
  }
  
}

main().then(result => {
  console.log('\n=== P4 Summary ===')
  console.log(JSON.stringify(result, null, 2))
}).catch(error => {
  console.error(`P4 failed: ${error.message}`)
  
  // Save error results
  const errorResult = {
    status: 500,
    data: { error: error.message }
  }
  saveProbeResults('p4-hairstyle-error', {}, errorResult, 0)
  
  process.exit(1)
})