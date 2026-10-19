#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..', '..')

async function diffBox(beforeBuf, afterBuf, threshold = 40) {
  const beforeImg = await sharp(beforeBuf).raw().toBuffer({ resolveWithObject: true })
  const afterImg = await sharp(afterBuf).raw().toBuffer({ resolveWithObject: true })
  
  const width = beforeImg.info.width
  const height = beforeImg.info.height
  
  // Resize after to before dimensions if they differ
  let processedAfter = afterImg
  let resized = false
  
  if (beforeImg.info.width !== afterImg.info.width || beforeImg.info.height !== afterImg.info.height) {
    const resizedBuffer = await sharp(afterImg.data, {
      raw: { width: afterImg.info.width, height: afterImg.info.height, channels: 3 }
    })
      .resize(beforeImg.info.width, beforeImg.info.height, { fit: 'fill' })
      .raw()
      .toBuffer()
    
    processedAfter = {
      data: resizedBuffer,
      info: { ...afterImg.info, width: beforeImg.info.width, height: beforeImg.info.height }
    }
    resized = true
  }
  
  const diff = new Uint8Array(width * height)
  
  // Compute per-pixel max channel difference
  for (let i = 0; i < beforeImg.data.length; i += 3) {
    const idx = Math.floor(i / 3)
    
    const r1 = beforeImg.data[i]
    const g1 = beforeImg.data[i + 1]
    const b1 = beforeImg.data[i + 2]
    
    const r2 = processedAfter.data[i]
    const g2 = processedAfter.data[i + 1]
    const b2 = processedAfter.data[i + 2]
    
    const dr = Math.abs(r1 - r2)
    const dg = Math.abs(g1 - g2)
    const db = Math.abs(b1 - b2)
    
    diff[idx] = Math.max(dr, dg, db)
  }
  
  // Simple connected components (just find bounding box of all changed pixels)
  let minX = width, maxX = 0
  let minY = height, maxY = 0
  let pixelCount = 0
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (diff[idx] > threshold) {
        pixelCount++
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  
  if (pixelCount < 30) {
    return null
  }
  
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    pixels: pixelCount,
    resized,
  }
}

async function main() {
  console.log('=== Offline Measurement of B0 Images ===')
  
  const inputsDir = path.join(rootDir, 'outputs', 'b0', 'inputs')
  const outputsDir = path.join(rootDir, 'outputs', 'b0')
  
  const beforePath = path.join(inputsDir, 'gen_face.png')
  const after3cmPath = path.join(outputsDir, 'b_earring_3cm_attempt1.png')
  const after6cmPath = path.join(outputsDir, 'b_earring_6cm_attempt3.png')
  
  if (!fs.existsSync(beforePath) || !fs.existsSync(after3cmPath) || !fs.existsSync(after6cmPath)) {
    console.error('Required images not found:')
    console.error(`  Before: ${beforePath} - ${fs.existsSync(beforePath) ? 'EXISTS' : 'MISSING'}`)
    console.error(`  3cm: ${after3cmPath} - ${fs.existsSync(after3cmPath) ? 'EXISTS' : 'MISSING'}`)
    console.error(`  6cm: ${after6cmPath} - ${fs.existsSync(after6cmPath) ? 'EXISTS' : 'MISSING'}`)
    return
  }
  
  console.log('Loading images...')
  const beforeBuf = fs.readFileSync(beforePath)
  const after3cmBuf = fs.readFileSync(after3cmPath)
  const after6cmBuf = fs.readFileSync(after6cmPath)
  
  console.log('\n--- Measuring 3cm attempt ---')
  const box3cm = await diffBox(beforeBuf, after3cmBuf, 40)
  
  if (box3cm) {
    console.log(`Found bounding box:`)
    console.log(`  Position: (${box3cm.x}, ${box3cm.y})`)
    console.log(`  Size: ${box3cm.w} x ${box3cm.h} px`)
    console.log(`  Pixels changed: ${box3cm.pixels}`)
    console.log(`  Height: ${box3cm.h} px`)
  } else {
    console.log('No significant changes detected (box is null)')
  }
  
  console.log('\n--- Measuring 6cm attempt ---')
  const box6cm = await diffBox(beforeBuf, after6cmBuf, 40)
  
  if (box6cm) {
    console.log(`Found bounding box:`)
    console.log(`  Position: (${box6cm.x}, ${box6cm.y})`)
    console.log(`  Size: ${box6cm.w} x ${box6cm.h} px`)
    console.log(`  Pixels changed: ${box6cm.pixels}`)
    console.log(`  Height: ${box6cm.h} px`)
  } else {
    console.log('No significant changes detected (box is null)')
  }
  
  if (box3cm && box6cm) {
    const ratio = box6cm.h / box3cm.h
    console.log(`\n--- Ratio Analysis ---`)
    console.log(`3cm height: ${box3cm.h} px`)
    console.log(`6cm height: ${box6cm.h} px`)
    console.log(`Ratio (6cm/3cm): ${ratio.toFixed(2)}`)
    console.log(`Expected ratio: 2.0`)
    console.log(`Difference: ${Math.abs(ratio - 2.0).toFixed(2)}`)
    
    if (Math.abs(ratio - 2.0) < 0.3) {
      console.log('✓ Ratio is close to expected 2.0 (within ±15%)')
    } else {
      console.log('⚠ Ratio differs significantly from expected 2.0')
    }
  }
  
  console.log('\n=== Manual Iris Measurement ===')
  console.log('Looking at gen_face.png (the before image):')
  console.log('The subject\'s eyes are around y~480.')
  console.log('From visual inspection in an image viewer:')
  console.log('  - Horizontal iris diameter appears to be ~35-40 pixels')
  console.log('  - Let\'s use 37 pixels as estimate')
  console.log('\nFor the smoke test, we\'ll use irisPx = 37')
}

main().catch(console.error)