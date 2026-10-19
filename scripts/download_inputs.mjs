#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadImage(url, outputPath) {
    try {
        console.log(`Downloading: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to download: ${response.status}`);
            return false;
        }
        
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(buffer));
        console.log(`Saved to: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return false;
    }
}

async function getImageDimensions(imagePath) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        const script = `
            Add-Type -AssemblyName System.Drawing
            try {
                $image = [System.Drawing.Image]::FromFile('${imagePath.replace(/\\/g, '\\\\').replace(/'/g, "''")}')
                $width = $image.Width
                $height = $image.Height
                $size = (Get-Item '${imagePath.replace(/\\/g, '\\\\').replace(/'/g, "''")}').Length
                $image.Dispose()
                [PSCustomObject]@{
                    Width = $width
                    Height = $height
                    Size = $size
                }
            } catch {
                [PSCustomObject]@{
                    Error = $_.Exception.Message
                }
            }
        `;
        
        exec(`powershell -Command "${script}"`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                try {
                    const data = JSON.parse(stdout.trim());
                    if (data.Error) {
                        reject(new Error(data.Error));
                    } else {
                        resolve(data);
                    }
                } catch (e) {
                    reject(e);
                }
            }
        });
    });
}

async function main() {
    console.log('=== Downloading input images ===');
    
    const inputsDir = path.join(__dirname, '..', 'outputs', 'b0', 'inputs');
    
    // URLs
    const FACE_URL = 'https://plugins-media.makeupar.com/strapi/assets/sample_Image_1_202b6bf6e6.jpg';
    const EARRING_URL = 'https://images.metmuseum.org/CRDImages/is/original/LC-15_95_129.jpg';
    
    // Download face
    const facePath = path.join(inputsDir, 'face.jpg');
    const faceSuccess = await downloadImage(FACE_URL, facePath);
    
    // Download earring
    const earringPath = path.join(inputsDir, 'earring.jpg');
    const earringSuccess = await downloadImage(EARRING_URL, earringPath);
    
    if (!faceSuccess || !earringSuccess) {
        console.error('Failed to download one or both images');
        process.exit(1);
    }
    
    // Get dimensions
    console.log('\n=== Getting image dimensions ===');
    
    try {
        const faceDims = await getImageDimensions(facePath);
        const earringDims = await getImageDimensions(earringPath);
        
        console.log('\nFace image:');
        console.log(`  Dimensions: ${faceDims.Width} x ${faceDims.Height} px`);
        console.log(`  Size: ${(faceDims.Size / 1024).toFixed(2)} KB`);
        
        console.log('\nEarring image:');
        console.log(`  Dimensions: ${earringDims.Width} x ${earringDims.Height} px`);
        console.log(`  Size: ${(earringDims.Size / (1024 * 1024)).toFixed(2)} MB`);
        
        const longSide = Math.max(earringDims.Width, earringDims.Height);
        const sizeMB = earringDims.Size / (1024 * 1024);
        
        console.log(`\nEarring API requirements check:`);
        console.log(`  Long side: ${longSide}px (needs <= 4096)`);
        console.log(`  File size: ${sizeMB.toFixed(2)} MB (needs < 10 MB)`);
        
        if (longSide > 4096 || sizeMB >= 10) {
            console.log(`\nWARNING: Earring image needs resizing for API!`);
            console.log(`Would need to create resized copy (long side 1500px) and upload via File API.`);
        } else {
            console.log(`\nEarring image meets API requirements.`);
        }
        
        // Save results
        const results = {
            face: {
                url: FACE_URL,
                path: facePath,
                width: faceDims.Width,
                height: faceDims.Height,
                sizeBytes: faceDims.Size,
                sizeKB: faceDims.Size / 1024
            },
            earring: {
                url: EARRING_URL,
                path: earringPath,
                width: earringDims.Width,
                height: earringDims.Height,
                sizeBytes: earringDims.Size,
                sizeMB: sizeMB,
                longSide: longSide,
                meetsRequirements: longSide <= 4096 && sizeMB < 10
            }
        };
        
        const resultsPath = path.join(__dirname, '..', 'outputs', 'b0', 'input_dimensions.json');
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
        console.log(`\nResults saved to: ${resultsPath}`);
        
    } catch (error) {
        console.error(`Error getting dimensions: ${error.message}`);
    }
}

main().catch(console.error);