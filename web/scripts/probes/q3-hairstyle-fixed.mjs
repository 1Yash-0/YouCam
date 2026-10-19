#!/usr/bin/env node

import { upload, runTask, getCreditBalance, request } from './lib.mjs'
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
    const stats = fs.statSync(inputPath)
    return { width: 0, height: 0 } // Unknown dimensions
  }
}

async function main() {
  console.log('=== Q3: HAIRSTYLE REPROBE (FIXED) ===')
  
  // Get starting balance
  const startBalance = await getCreditBalance()
  console.log(`Starting balance: ${startBalance} units`)
  
  // Part (a): Get hair templates (free) - FIXED: don't use page parameter
  console.log('\n--- Part (a): Get hair templates ---')
  
  // Get first page only (no page parameter)
  const result = await request('GET', '/s2s/v2.1/task/template/hair-transfer?page_size=20')
  
  if (result.status !== 200 || !result.data?.data?.templates) {
    console.error(`Failed to get templates: ${JSON.stringify(result.data)}`)
    throw new Error('Failed to get hair templates')
  }
  
  const templates = result.data.data.templates
  console.log(`Got ${templates.length} templates`)
  
  // Save templates
  const templatesPath = path.join(OUTPUTS_DIR, 'hair_templates.json')
  const templatesData = {
    fetchedAt: new Date().toISOString(),
    count: templates.length,
    templates: templates
  }
  
  fs.writeFileSync(templatesPath, JSON.stringify(templatesData, null, 2))
  console.log(`Saved ${templates.length} templates to: ${templatesPath}`)
  
  // List ids+titles that are updo/bun/ponytail/tied
  console.log('\n=== Hair Template Candidates (updo/bun/ponytail/tied) ===')
  const candidates = []
  templates.forEach(template => {
    const title = template.title?.toLowerCase() || ''
    const description = template.description?.toLowerCase() || ''
    const searchText = title + ' ' + description
    
    if (searchText.includes('updo') || searchText.includes('bun') || 
        searchText.includes('ponytail') || searchText.includes('tied') ||
        searchText.includes('up do') || searchText.includes('hair up')) {
      candidates.push({
        id: template.template_id,
        title: template.title,
        description: template.description,
        supports_hair_color: template.supports_hair_color || false
      })
      console.log(`✓ ${template.template_id}: ${template.title} ${template.supports_hair_color ? '(supports hair color)' : ''}`)
    }
  })
  
  if (candidates.length === 0) {
    console.log('No updo/bun/ponytail/tied templates found. Using first available template.')
    const firstTemplate = templates[0]
    if (firstTemplate) {
      candidates.push({
        id: firstTemplate.template_id,
        title: firstTemplate.title,
        description: firstTemplate.description,
        supports_hair_color: firstTemplate.supports_hair_color || false
      })
      console.log(`Using first template: ${firstTemplate.template_id}: ${firstTemplate.title}`)
    }
  }
  
  // Select the best candidate (prefer one that supports hair color)
  const bestCandidate = candidates.find(t => t.supports_hair_color) || candidates[0]
  if (!bestCandidate) {
    throw new Error('No hair templates found')
  }
  
  console.log(`\nSelected template: ${bestCandidate.id} - ${bestCandidate.title} ${bestCandidate.supports_hair_color ? '(supports hair color)' : ''}`)
  
  // Part (b): Generate hair-down turned face (1 unit)
  console.log('\n--- Part (b): Generate hair-down turned face ---')
  const hairDownPrompt = 'photorealistic studio portrait of a young woman, head turned 35 degrees to her left, long loose straight hair down covering her ears, neutral grey background, soft even light, sharp focus, chest-up'
  const textToImageBody = {
    model: 'youcam-image-v2',
    prompt: hairDownPrompt,
    negative_prompt: 'blurry, low quality, distorted, watermark, text, other people, multiple faces, updo, bun, ponytail, tied hair',
    size: '1104*1472',
    prompt_extend: true
  }
  
  console.log('Text-to-image request for hair-down face:', JSON.stringify(textToImageBody, null, 2))
  
  const textToImageResult = await runTask('/s2s/v2.0/task/text-to-image/youcam', textToImageBody)
  
  if (!textToImageResult.resultImageUrl) {
    throw new Error('No result image URL from text-to-image generation')
  }
  
  // Download the generated image
  const hairDownPath = path.join(OUTPUTS_DIR, 'hair_down_original.png')
  const imageResponse = await fetch(textToImageResult.resultImageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`)
  }
  
  const imageBuffer = await imageResponse.arrayBuffer()
  fs.writeFileSync(hairDownPath, Buffer.from(imageBuffer))
  console.log(`Generated hair-down face saved to: ${hairDownPath}`)
  
  // Convert to JPG with long side 1024 using sharp
  const hairDownJpgPath = path.join(OUTPUTS_DIR, 'hair_down_resized.jpg')
  console.log('Resizing image to max dimension 1024...')
  await resizeImage(hairDownPath, hairDownJpgPath, 1024)
  
  // Get intermediate balance after text-to-image
  const intermediateBalance1 = await getCreditBalance()
  const textToImageUnits = startBalance - intermediateBalance1
  console.log(`Text-to-image units used: ${textToImageUnits}`)
  
  // Upload the resized image
  console.log('\n--- Uploading resized hair-down face ---')
  const srcFileId = await upload(hairDownJpgPath)
  console.log(`Uploaded hair-down face: ${srcFileId}`)
  
  // Part (c): Run hair-transfer v2.1 task (2 units)
  console.log('\n--- Part (c): Run hair-transfer v2.1 task ---')
  // According to docs: https://docs.perfectcorp.com/reference/ai_hairstyle
  const hairTransferBody = {
    src_file_id: srcFileId,
    template_id: bestCandidate.id,
    parameters: {
      keep_hair_color: bestCandidate.supports_hair_color, // Keep user's hair color if template supports it
      hair_color: bestCandidate.supports_hair_color ? undefined : '#000000' // Default black if not supported
    }
  }
  
  console.log('Hair-transfer request:', JSON.stringify(hairTransferBody, null, 2))
  
  const hairTransferResult = await runTask('/s2s/v2.1/task/hair-transfer', hairTransferBody)
  
  if (!hairTransferResult.resultImageUrl) {
    throw new Error('No result image URL from hair-transfer')
  }
  
  // Save hair-up result
  const hairUpPath = path.join(OUTPUTS_DIR, 'q3-hair-up.jpg')
  const hairUpResponse = await fetch(hairTransferResult.resultImageUrl)
  if (!hairUpResponse.ok) {
    throw new Error(`Failed to download hair-transfer result: ${hairUpResponse.status}`)
  }
  
  const hairUpBuffer = await hairUpResponse.arrayBuffer()
  fs.writeFileSync(hairUpPath, Buffer.from(hairUpBuffer))
  console.log(`Hair-transfer result saved to: ${hairUpPath}`)
  
  // Get intermediate balance after hair-transfer
  const intermediateBalance2 = await getCreditBalance()
  const hairTransferUnits = intermediateBalance1 - intermediateBalance2
  console.log(`Hair-transfer units used: ${hairTransferUnits}`)
  
  // Part (d): Run earring on hair-up result (1 unit)
  console.log('\n--- Part (d): Run earring on hair-up result ---')
  
  // Upload hair-up result
  console.log('Uploading hair-up result...')
  const hairUpFileId = await upload(hairUpPath)
  console.log(`Uploaded hair-up face: ${hairUpFileId}`)
  
  // Upload earring product
  console.log('Uploading earring product...')
  const earringPath = path.join(ROOT_DIR, 'outputs/b0/inputs/gen_earring.png')
  if (!fs.existsSync(earringPath)) {
    throw new Error(`Earring image not found at ${earringPath}`)
  }
  const earringFileId = await upload(earringPath)
  console.log(`Uploaded earring: ${earringFileId}`)
  
  // Run earring task
  const earringBody = {
    src_file_id: hairUpFileId,
    ref_file_ids: [earringFileId],
    source_info: {
      name: "q3-hair-up.jpg"
    },
    object_infos: [
      {
        name: "gen_earring.png",
        parameter: {
          scale: 3.0, // 3.0 cm
          wearing_location: "ear_right"
        }
      }
    ]
  }
  
  console.log('Earring request:', JSON.stringify(earringBody, null, 2))
  
  const earringResult = await runTask('/s2s/v2.0/task/2d-vto/earring', earringBody)
  
  if (!earringResult.resultImageUrl) {
    throw new Error('No result image URL from earring task')
  }
  
  // Save earring result
  const hairEarringPath = path.join(OUTPUTS_DIR, 'q3-hair-earring.png')
  const earringResultResponse = await fetch(earringResult.resultImageUrl)
  if (!earringResultResponse.ok) {
    throw new Error(`Failed to download earring result: ${earringResultResponse.status}`)
  }
  
  const earringResultBuffer = await earringResultResponse.arrayBuffer()
  fs.writeFileSync(hairEarringPath, Buffer.from(earringResultBuffer))
  console.log(`Earring result saved to: ${hairEarringPath}`)
  
  // Get final balance
  const finalBalance = await getCreditBalance()
  const earringUnits = intermediateBalance2 - finalBalance
  const totalUnits = textToImageUnits + hairTransferUnits + earringUnits
  
  console.log(`\n--- Q3 Results ---`)
  console.log(`Text-to-image units: ${textToImageUnits}`)
  console.log(`Hair-transfer units: ${hairTransferUnits}`)
  console.log(`Earring units: ${earringUnits}`)
  console.log(`Total units used: ${totalUnits}`)
  console.log(`Ending balance: ${finalBalance} units`)
  
  return {
    success: true,
    candidates,
    bestCandidate,
    srcFileId,
    hairUpFileId,
    earringFileId,
    textToImageUnits,
    hairTransferUnits,
    earringUnits,
    totalUnits,
    hairUpPath,
    hairEarringPath
  }
}

main().catch(error => {
  console.error(`\nQ3 failed: ${error.message}`)
  process.exit(1)
})