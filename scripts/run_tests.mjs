#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTask, checkCredit, checkFeatureCost, downloadImage } from './feasibility.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const FACE_URL = 'https://plugins-media.makeupar.com/strapi/assets/sample_Image_1_202b6bf6e6.jpg';
const EARRING_URL = 'https://images.metmuseum.org/CRDImages/is/original/LC-15_95_129.jpg';

// Base earring task body
function createEarringBody(faceUrl, earringUrl, scale, isRightEar = true) {
    return {
        src_file_url: faceUrl,
        ref_file_urls: [earringUrl],
        source_info: { name: faceUrl },
        object_infos: [
            {
                name: earringUrl,
                parameter: {
                    earring_need_remove_background: true,
                    earring_anchor_point: null,
                    earring_wearing_location: null,
                    earring_scale: scale,
                    earring_is_right_ear: isRightEar,
                    earring_occluded_type: 0,
                    earring_shadow_intensity: 0.15,
                    earring_ambient_light_intensity: 1.0
                }
            }
        ]
    };
}

// Download inputs
async function downloadInputs() {
    console.log('\n=== Downloading input images ===');
    
    const inputsDir = path.join(__dirname, '..', 'outputs', 'b0', 'inputs');
    
    // Download face
    const facePath = path.join(inputsDir, 'face.jpg');
    console.log(`Downloading face image to ${facePath}`);
    const faceSuccess = await downloadImage(FACE_URL, facePath);
    
    // Download earring
    const earringPath = path.join(inputsDir, 'earring.jpg');
    console.log(`Downloading earring image to ${earringPath}`);
    const earringSuccess = await downloadImage(EARRING_URL, earringPath);
    
    return { faceSuccess, earringSuccess, facePath, earringPath };
}

// Get image dimensions using PowerShell
async function getImageDimensions(imagePath) {
    try {
        const script = `
            Add-Type -AssemblyName System.Drawing
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
        `;
        
        const result = await new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            exec(`powershell -Command "${script}"`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    try {
                        const data = JSON.parse(stdout.trim());
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
        
        return result;
    } catch (error) {
        console.error(`Error getting dimensions for ${imagePath}: ${error.message}`);
        return null;
    }
}

// Check if earring needs resizing
async function checkEarringSize(earringPath) {
    const dims = await getImageDimensions(earringPath);
    if (!dims) return null;
    
    const longSide = Math.max(dims.Width, dims.Height);
    const sizeMB = dims.Size / (1024 * 1024);
    
    return {
        width: dims.Width,
        height: dims.Height,
        sizeBytes: dims.Size,
        sizeMB: sizeMB,
        longSide: longSide,
        needsResize: longSide > 4096 || sizeMB >= 10
    };
}

// Main test runner
async function runAllTests() {
    console.log('=== YouCam Feasibility Tests ===');
    
    // STEP 1: Already verified Node >= 18
    console.log(`\nNode version: ${process.version}`);
    
    // STEP 3: Free checks
    console.log('\n--- STEP 3: Free API checks ---');
    const creditBefore = await checkCredit();
    const featureCost = await checkFeatureCost();
    
    // Check for 401
    if (creditBefore.status === 401) {
        console.error('API key rejected (401). Stopping.');
        process.exit(1);
    }
    
    // STEP 4: Download inputs
    console.log('\n--- STEP 4: Download input images ---');
    const { faceSuccess, earringSuccess, facePath, earringPath } = await downloadInputs();
    
    if (!faceSuccess || !earringSuccess) {
        console.error('Failed to download input images');
        process.exit(1);
    }
    
    // Get dimensions
    const faceDims = await getImageDimensions(facePath);
    const earringCheck = await checkEarringSize(earringPath);
    
    console.log('\nInput image details:');
    console.log(`Face: ${faceDims.Width}x${faceDims.Height}, ${(faceDims.Size/1024).toFixed(2)} KB`);
    console.log(`Earring: ${earringCheck.width}x${earringCheck.height}, ${earringCheck.sizeMB.toFixed(2)} MB, long side: ${earringCheck.longSide}px`);
    
    if (earringCheck.needsResize) {
        console.log('\nWARNING: Earring image needs resizing (long side > 4096 or >= 10 MB)');
        console.log('Would need to upload via File API instead of URL');
    }
    
    // Store results
    const results = {
        nodeVersion: process.version,
        creditBefore: creditBefore.data,
        featureCost: featureCost.data,
        inputs: {
            face: faceDims,
            earring: earringCheck
        },
        tasks: []
    };
    
    // STEP 5: Earring task test A (3cm)
    console.log('\n--- STEP 5: Earring test A (3cm) ---');
    const body3cm = createEarringBody(FACE_URL, EARRING_URL, 3.0, true);
    
    let result3cm = await runTask('/s2s/v2.0/task/2d-vto/earring', body3cm, 'earring_3cm');
    results.tasks.push({
        label: 'earring_3cm',
        body: body3cm,
        result: result3cm
    });
    
    // Handle errors
    let rightEarWorked = true;
    if (!result3cm.success && result3cm.taskStatus === 'error') {
        const errorCode = result3cm.data?.data?.error_code;
        console.log(`Task error code: ${errorCode}`);
        
        // Check if right ear isn't visible
        if (errorCode && errorCode.includes('right') || errorCode === 'EAR_NOT_VISIBLE') {
            console.log('Retrying with earring_is_right_ear: false');
            const body3cmLeft = createEarringBody(FACE_URL, EARRING_URL, 3.0, false);
            result3cm = await runTask('/s2s/v2.0/task/2d-vto/earring', body3cmLeft, 'earring_3cm_left');
            results.tasks.push({
                label: 'earring_3cm_left',
                body: body3cmLeft,
                result: result3cm
            });
            rightEarWorked = false;
        }
    }
    
    if (!result3cm.success) {
        console.log('\nTest A failed. Stopping further tests.');
        saveResults(results);
        return results;
    }
    
    // STEP 6: Earring test B (6cm) - only if step 5 succeeded
    console.log('\n--- STEP 6: Earring test B (6cm) ---');
    const body6cm = createEarringBody(FACE_URL, EARRING_URL, 6.0, rightEarWorked);
    const result6cm = await runTask('/s2s/v2.0/task/2d-vto/earring', body6cm, 'earring_6cm');
    results.tasks.push({
        label: 'earring_6cm',
        body: body6cm,
        result: result6cm
    });
    
    if (!result6cm.success) {
        console.log('\nTest B failed. Stopping further tests.');
        saveResults(results);
        return results;
    }
    
    // STEP 7: Earring test C (4.5cm) - only if both succeeded
    console.log('\n--- STEP 7: Earring test C (4.5cm) ---');
    const body4_5cm = createEarringBody(FACE_URL, EARRING_URL, 4.5, rightEarWorked);
    const result4_5cm = await runTask('/s2s/v2.0/task/2d-vto/earring', body4_5cm, 'earring_4_5cm');
    results.tasks.push({
        label: 'earring_4_5cm',
        body: body4_5cm,
        result: result4_5cm
    });
    
    // STEP 8: Get credit after
    console.log('\n--- Final credit check ---');
    const creditAfter = await checkCredit();
    results.creditAfter = creditAfter.data;
    
    console.log('\n=== Tests completed ===');
    saveResults(results);
    return results;
}

function saveResults(results) {
    const resultsPath = path.join(__dirname, '..', 'outputs', 'b0', 'test_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`Results saved to ${resultsPath}`);
}

// Run the tests
runAllTests().catch(console.error);