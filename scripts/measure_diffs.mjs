#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadImageToCanvas(imagePath) {
    try {
        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        return { canvas, ctx, width: image.width, height: image.height };
    } catch (error) {
        console.error(`Error loading image ${imagePath}: ${error.message}`);
        return null;
    }
}

function getPixelDiff(rgba1, rgba2, threshold = 40) {
    const rDiff = Math.abs(rgba1[0] - rgba2[0]);
    const gDiff = Math.abs(rgba1[1] - rgba2[1]);
    const bDiff = Math.abs(rgba1[2] - rgba2[2]);
    
    return rDiff > threshold || gDiff > threshold || bDiff > threshold;
}

async function computeBoundingBox(inputPath, outputPath, label) {
    console.log(`\n=== Computing bounding box for ${label} ===`);
    
    const input = await loadImageToCanvas(inputPath);
    const output = await loadImageToCanvas(outputPath);
    
    if (!input || !output) {
        console.log('Failed to load images');
        return null;
    }
    
    // Check dimensions match
    if (input.width !== output.width || input.height !== output.height) {
        console.log(`Dimensions don't match: input=${input.width}x${input.height}, output=${output.width}x${output.height}`);
        console.log('Skipping diff computation');
        return { error: 'dimension_mismatch', inputSize: `${input.width}x${input.height}`, outputSize: `${output.width}x${output.height}` };
    }
    
    const inputData = input.ctx.getImageData(0, 0, input.width, input.height).data;
    const outputData = output.ctx.getImageData(0, 0, output.width, output.height).data;
    
    let minX = input.width;
    let minY = input.height;
    let maxX = 0;
    let maxY = 0;
    let diffCount = 0;
    
    for (let y = 0; y < input.height; y++) {
        for (let x = 0; x < input.width; x++) {
            const idx = (y * input.width + x) * 4;
            
            const inputPixel = [
                inputData[idx],
                inputData[idx + 1],
                inputData[idx + 2]
            ];
            
            const outputPixel = [
                outputData[idx],
                outputData[idx + 1],
                outputData[idx + 2]
            ];
            
            if (getPixelDiff(inputPixel, outputPixel)) {
                diffCount++;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    if (diffCount === 0) {
        console.log('No significant differences found');
        return { diffCount: 0, boundingBox: null };
    }
    
    const boundingBox = {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
    
    console.log(`Diff pixels: ${diffCount}`);
    console.log(`Bounding box: x=${boundingBox.x}, y=${boundingBox.y}, width=${boundingBox.width}, height=${boundingBox.height}`);
    
    return {
        diffCount,
        boundingBox,
        inputSize: `${input.width}x${input.height}`,
        outputSize: `${output.width}x${output.height}`
    };
}

async function main() {
    const inputFacePath = path.join(__dirname, '..', 'outputs', 'b0', 'inputs', 'face.jpg');
    
    // Check for output images
    const outputDir = path.join(__dirname, '..', 'outputs', 'b0');
    const results = {};
    
    try {
        const files = fs.readdirSync(outputDir);
        const imageFiles = files.filter(f => f.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !f.includes('inputs'));
        
        console.log(`Found ${imageFiles.length} output images`);
        
        for (const file of imageFiles) {
            const outputPath = path.join(outputDir, file);
            const label = path.basename(file, path.extname(file));
            
            const diffResult = await computeBoundingBox(inputFacePath, outputPath, label);
            results[label] = diffResult;
        }
        
        // Calculate ratios if we have both 3cm and 6cm results
        if (results.earring_3cm?.boundingBox && results.earring_6cm?.boundingBox) {
            const ratio = results.earring_6cm.boundingBox.height / results.earring_3cm.boundingBox.height;
            console.log(`\nHeight ratio (6cm/3cm): ${ratio.toFixed(2)}`);
            results.heightRatio = ratio;
        }
        
        // Save results
        const resultsPath = path.join(outputDir, 'diff_measurements.json');
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
        console.log(`\nResults saved to: ${resultsPath}`);
        
    } catch (error) {
        console.error(`Error reading output directory: ${error.message}`);
    }
}

// Note: This script requires the 'canvas' npm package
// Since we can't install npm dependencies per the instructions,
// this is a template for future use when canvas is available
console.log('Note: This script requires the "canvas" npm package for image processing.');
console.log('Install it with: npm install canvas');
console.log('\nScript template created successfully.');

// Don't run automatically since we don't have canvas
if (false) {
    main().catch(console.error);
}