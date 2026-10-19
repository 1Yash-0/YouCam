#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as delay } from 'timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse .env.local
function parseEnvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex === -1) continue;
        
        const key = trimmed.substring(0, equalsIndex).trim();
        const value = trimmed.substring(equalsIndex + 1).trim();
        env[key] = value;
    }
    
    return env;
}

// Load environment
const env = parseEnvFile(path.join(__dirname, '..', '.env.local'));
const API_KEY = env.YOUCAM_API_KEY;
const BASE_URL = env.YOUCAM_API_BASE;

if (!API_KEY || !BASE_URL) {
    console.error('Missing YOUCAM_API_KEY or YOUCAM_API_BASE in .env.local');
    process.exit(1);
}

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'outputs', 'b0');
const INPUT_DIR = path.join(OUTPUT_DIR, 'inputs');

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(INPUT_DIR)) {
    fs.mkdirSync(INPUT_DIR, { recursive: true });
}

// Results storage
const results = {
    startTime: new Date().toISOString(),
    initialCredit: null,
    finalCredit: null,
    planB: {
        imageGeneration: {
            face: null,
            earring: null
        },
        earringAttempts: [],
        success: false,
        savedImages: []
    },
    measurements: [],
    unitsUsed: 0,
    failedAttempts: 0,
    totalElapsedTime: 0
};

// Helper function for API calls
async function makeApiCall(method, endpoint, body = null, label = '') {
    const url = `${BASE_URL}${endpoint}`;
    const startTime = Date.now();
    
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    console.log(`\n=== ${label} ===`);
    console.log(`${method} ${endpoint}`);
    if (body) {
        console.log(`Body: ${JSON.stringify(body, null, 2)}`);
    }
    
    try {
        const response = await fetch(url, options);
        const responseTime = (Date.now() - startTime) / 1000;
        const data = await response.json().catch(() => ({ error: 'Invalid JSON response' }));
        
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${JSON.stringify(data, null, 2)}`);
        console.log(`Time: ${responseTime.toFixed(2)}s`);
        
        return {
            success: response.ok,
            status: response.status,
            data,
            elapsed: responseTime
        };
    } catch (error) {
        const responseTime = (Date.now() - startTime) / 1000;
        console.error(`Error: ${error.message}`);
        
        return {
            success: false,
            status: 0,
            data: { error: error.message },
            elapsed: responseTime
        };
    }
}

// Check credit balance
async function checkCreditBalance(label) {
    const result = await makeApiCall('GET', '/s2s/v1.0/client/credit', null, label);
    
    if (result.status === 401) {
        console.error('401 Unauthorized - API key rejected. Stopping.');
        return null;
    }
    
    if (result.data?.results) {
        console.log(`\nCredit balance:`);
        result.data.results.forEach(token => {
            console.log(`  ${token.type}: ${token.amount_dec} units (expires: ${new Date(token.expiry).toISOString()})`);
        });
    }
    
    return result;
}

// Poll task status
async function pollTaskStatus(taskId, taskType = 'text-to-image/youcam') {
    const maxPolls = 60;
    const pollInterval = 3000;
    
    for (let i = 0; i < maxPolls; i++) {
        await delay(pollInterval);
        
        const pollResult = await makeApiCall('GET', `/s2s/v2.0/task/${taskType}/${taskId}`, null, `Poll ${i + 1}`);
        
        if (!pollResult.success) {
            console.log(`Poll ${i + 1} failed, continuing...`);
            continue;
        }
        
        const taskStatus = pollResult.data?.data?.task_status;
        console.log(`Poll ${i + 1}: status=${taskStatus || 'unknown'}`);
        
        if (taskStatus === 'success' || taskStatus === 'error') {
            return {
                taskStatus,
                result: pollResult,
                pollCount: i + 1
            };
        }
    }
    
    console.error('Polling timeout');
    return {
        taskStatus: 'timeout',
        result: null,
        pollCount: maxPolls
    };
}

// Download image from URL
async function downloadImage(imageUrl, outputPath) {
    try {
        console.log(`Downloading image from: ${imageUrl}`);
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error(`Failed to download image: ${response.status}`);
            return null;
        }
        
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(buffer));
        console.log(`Saved to: ${outputPath}`);
        return outputPath;
    } catch (error) {
        console.error(`Download error: ${error.message}`);
        return null;
    }
}

// Generate image using AI Image Generator
async function generateImage(prompt, size, filename, negativePrompt = '') {
    console.log(`\n=== Generating image: ${filename} ===`);
    console.log(`Prompt: ${prompt}`);
    console.log(`Size: ${size}`);
    
    const body = {
        "model": "youcam-image-v2",
        "prompt": prompt,
        "negative_prompt": negativePrompt || "Low resolution, low quality, distorted limbs, malformed fingers, oversaturated colors, wax-like appearance, no facial details, overly smooth surfaces, AI-generated look. Chaotic composition. Blurry or distorted text.",
        "size": size,
        "prompt_extend": true
    };
    
    // Create task
    const createResult = await makeApiCall('POST', '/s2s/v2.0/task/text-to-image/youcam', body, 'Create AI Image Generation task');
    
    if (!createResult.success) {
        console.error('Task creation failed');
        return {
            success: false,
            error: 'Task creation failed'
        };
    }
    
    const taskId = createResult.data?.data?.task_id;
    if (!taskId) {
        console.error('No task_id in response');
        return {
            success: false,
            error: 'No task_id in response'
        };
    }
    
    console.log(`Task ID: ${taskId}`);
    
    // Poll for completion
    const pollResult = await pollTaskStatus(taskId, 'text-to-image/youcam');
    
    if (pollResult.taskStatus === 'success') {
        console.log('Image generation succeeded!');
        results.unitsUsed += 1;
        
        // Extract image URL
        let imageUrl = null;
        const resultData = pollResult.result.data?.data;
        
        if (resultData?.results?.url) imageUrl = resultData.results.url;
        if (resultData?.results?.[0]?.url) imageUrl = resultData.results[0].url;
        if (resultData?.result?.url) imageUrl = resultData.result.url;
        
        if (!imageUrl) {
            console.error('No image URL found in result');
            return {
                success: false,
                error: 'No image URL found'
            };
        }
        
        // Download image
        const outputPath = path.join(INPUT_DIR, `${filename}.png`);
        const savedPath = await downloadImage(imageUrl, outputPath);
        
        return {
            success: true,
            taskId,
            imageUrl,
            savedPath,
            pollResult
        };
    } else {
        console.log(`Image generation failed with status: ${pollResult.taskStatus}`);
        results.failedAttempts++;
        
        return {
            success: false,
            taskId,
            error: pollResult.taskStatus,
            pollResult
        };
    }
}

// Run earring task with generated images
async function runEarringTaskWithGeneratedImages(faceUrl, earringUrl, scale, attemptNumber, isRightEar = true) {
    console.log(`\n=== Running earring task with generated images (scale=${scale}, right_ear=${isRightEar}) ===`);
    
    const body = {
        "src_file_url": faceUrl,
        "ref_file_urls": [earringUrl],
        "source_info": { "name": "generated_face" },
        "object_infos": [{
            "name": "generated_earring",
            "parameter": {
                "earring_need_remove_background": true,
                "earring_scale": scale,
                "earring_is_right_ear": isRightEar,
                "earring_occluded_type": 0,
                "earring_shadow_intensity": 0.15,
                "earring_ambient_light_intensity": 1.0
            }
        }]
    };
    
    // Create task
    const createResult = await makeApiCall('POST', '/s2s/v2.0/task/2d-vto/earring', body, `Create earring task (scale=${scale})`);
    
    if (!createResult.success) {
        console.error('Task creation failed');
        results.failedAttempts++;
        return {
            success: false,
            error: 'Task creation failed'
        };
    }
    
    const taskId = createResult.data?.data?.task_id;
    if (!taskId) {
        console.error('No task_id in response');
        results.failedAttempts++;
        return {
            success: false,
            error: 'No task_id in response'
        };
    }
    
    console.log(`Task ID: ${taskId}`);
    
    // Poll for completion
    const pollResult = await pollTaskStatus(taskId, '2d-vto/earring');
    
    if (pollResult.taskStatus === 'success') {
        console.log('Task succeeded!');
        results.unitsUsed += 1;
        
        // Download image
        const ext = 'png';
        const filename = `b_earring_${scale}cm_attempt${attemptNumber}`;
        const outputPath = path.join(OUTPUT_DIR, `${filename}.${ext}`);
        
        // Try to extract image URL
        let imageUrl = null;
        const resultData = pollResult.result.data?.data;
        
        if (resultData?.results?.url) imageUrl = resultData.results.url;
        if (resultData?.results?.[0]?.url) imageUrl = resultData.results[0].url;
        if (resultData?.result?.url) imageUrl = resultData.result.url;
        
        let savedPath = null;
        if (imageUrl) {
            savedPath = await downloadImage(imageUrl, outputPath);
        }
        
        return {
            success: true,
            taskId,
            scale,
            isRightEar,
            imageUrl,
            savedPath,
            pollResult
        };
    } else {
        console.log(`Task failed with status: ${pollResult.taskStatus}`);
        results.failedAttempts++;
        
        return {
            success: false,
            taskId,
            scale,
            isRightEar,
            error: pollResult.taskStatus,
            pollResult
        };
    }
}

// Upload file to YouCam API (if needed)
async function uploadFile(filePath) {
    console.log(`\n=== Uploading file: ${filePath} ===`);
    
    // First get upload URL
    const initResult = await makeApiCall('POST', '/s2s/v2.0/file', null, 'Initialize file upload');
    
    if (!initResult.success || !initResult.data?.data?.file_id) {
        console.error('Failed to initialize file upload');
        return null;
    }
    
    const fileId = initResult.data.data.file_id;
    console.log(`File ID: ${fileId}`);
    
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Upload file content
    const uploadResult = await makeApiCall('PUT', `/s2s/v2.0/file/${fileId}`, null, `Upload file ${path.basename(filePath)}`);
    
    // Note: The actual file upload would need proper multipart/form-data handling
    // For now, we'll use direct URLs if available
    
    return fileId;
}

// Main execution
async function main() {
    console.log('=== EXECUTING PLAN B ===');
    console.log(`Start time: ${results.startTime}`);
    console.log(`API Base: ${BASE_URL}`);
    
    const overallStartTime = Date.now();
    
    try {
        // Step 1: Check initial credit
        console.log('\n=== STEP 1: Checking initial credit balance ===');
        results.initialCredit = await checkCreditBalance('Initial Credit Balance');
        
        if (!results.initialCredit) {
            console.error('Failed to get initial credit balance');
            return;
        }
        
        // Check budget
        const maxBudget = 8;
        const maxFailedAttempts = 8;
        console.log(`\nBudget constraints: Max ${maxBudget} units, Max ${maxFailedAttempts} failed attempts`);
        console.log(`Current: ${results.unitsUsed} units used, ${results.failedAttempts} failed attempts`);
        
        // Step 2: Generate face image
        console.log('\n=== STEP 2: Generating face image ===');
        const facePrompt = "photorealistic studio portrait of a young woman, head turned 35 degrees to her left showing her right ear clearly, hair tied back behind the ears, bare earlobe with no earring, neutral grey background, soft even lighting, sharp focus, chest-up";
        const faceSize = "1104*1472"; // Portrait resolution
        
        const faceResult = await generateImage(facePrompt, faceSize, 'gen_face');
        results.planB.imageGeneration.face = faceResult;
        
        if (!faceResult.success) {
            console.error('Failed to generate face image. Stopping.');
            return;
        }
        
        // Step 3: Generate earring image
        console.log('\n=== STEP 3: Generating earring image ===');
        const earringPrompt = "product photo of a single gold drop earring with a small hook, hanging vertically, front view, centred, plain white background, sharp focus";
        const earringSize = "1328*1328"; // Square resolution
        
        const earringResult = await generateImage(earringPrompt, earringSize, 'gen_earring');
        results.planB.imageGeneration.earring = earringResult;
        
        if (!earringResult.success) {
            console.error('Failed to generate earring image. Stopping.');
            return;
        }
        
        // Step 4: Run earring task with generated images (scale 3.0)
        console.log('\n=== STEP 4: Running earring task with generated images (scale=3.0) ===');
        
        // Use direct URLs from generation results
        const faceImageUrl = faceResult.imageUrl;
        const earringImageUrl = earringResult.imageUrl;
        
        if (!faceImageUrl || !earringImageUrl) {
            console.error('Missing image URLs. Cannot proceed with earring task.');
            return;
        }
        
        // Attempt 1: right ear true
        let earringAttempt1 = await runEarringTaskWithGeneratedImages(faceImageUrl, earringImageUrl, 3.0, 1, true);
        results.planB.earringAttempts.push(earringAttempt1);
        
        if (!earringAttempt1.success) {
            // Check if error is detection-related
            const errorMsg = JSON.stringify(earringAttempt1.pollResult?.result?.data).toLowerCase();
            if ((errorMsg.includes('detection') || errorMsg.includes('pose') || errorMsg.includes('earlobe')) && results.failedAttempts < maxFailedAttempts) {
                console.log('\nDetection/pose error detected, retrying with earring_is_right_ear=false');
                
                // Attempt 2: right ear false
                earringAttempt1 = await runEarringTaskWithGeneratedImages(faceImageUrl, earringImageUrl, 3.0, 2, false);
                results.planB.earringAttempts.push(earringAttempt1);
            }
        }
        
        if (earringAttempt1.success) {
            results.planB.success = true;
            results.planB.savedImages.push({
                scale: 3.0,
                path: earringAttempt1.savedPath,
                filename: `b_earring_3cm.png`,
                isRightEar: earringAttempt1.isRightEar
            });
            
            // Step 5: Run earring task with scale 6.0 using same successful parameters
            console.log('\n=== STEP 5: Running earring task with scale 6.0 ===');
            const earringAttempt2 = await runEarringTaskWithGeneratedImages(
                faceImageUrl, 
                earringImageUrl, 
                6.0, 
                3, 
                earringAttempt1.isRightEar
            );
            results.planB.earringAttempts.push(earringAttempt2);
            
            if (earringAttempt2.success) {
                results.planB.savedImages.push({
                    scale: 6.0,
                    path: earringAttempt2.savedPath,
                    filename: `b_earring_6cm.png`,
                    isRightEar: earringAttempt2.isRightEar
                });
            }
        }
        
        // Step 6: Check final credit
        console.log('\n=== STEP 6: Checking final credit balance ===');
        results.finalCredit = await checkCreditBalance('Final Credit Balance');
        
        // Calculate total elapsed time
        results.totalElapsedTime = (Date.now() - overallStartTime) / 1000;
        
        // Save results
        results.endTime = new Date().toISOString();
        const reportPath = path.join(OUTPUT_DIR, 'plan_b_results.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        
        console.log(`\n=== EXECUTION COMPLETE ===`);
        console.log(`Total elapsed time: ${results.totalElapsedTime.toFixed(2)}s`);
        console.log(`Units used: ${results.unitsUsed}`);
        console.log(`Failed attempts: ${results.failedAttempts}`);
        console.log(`Plan B success: ${results.planB.success}`);
        console.log(`Report saved to: ${reportPath}`);
        
        // Print summary
        console.log('\n=== SUMMARY ===');
        console.log('Generated images:');
        if (faceResult.savedPath) console.log(`  Face: ${faceResult.savedPath}`);
        if (earringResult.savedPath) console.log(`  Earring: ${earringResult.savedPath}`);
        
        console.log('\nSaved earring task results:');
        results.planB.savedImages.forEach(img => {
            console.log(`  ${img.filename}: ${img.path} (right_ear=${img.isRightEar})`);
        });
        
    } catch (error) {
        console.error(`Unhandled error: ${error.message}`);
        results.error = error.message;
        results.endTime = new Date().toISOString();
        
        const reportPath = path.join(OUTPUT_DIR, 'plan_b_results.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    }
}

// Run main
main().catch(console.error);