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
const INPUT_IMAGE_PATH = path.join(OUTPUT_DIR, 'inputs');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Results storage
const results = {
    startTime: new Date().toISOString(),
    initialCredit: null,
    finalCredit: null,
    planA: {
        attempts: [],
        success: false,
        savedImages: []
    },
    planB: {
        generatedImages: [],
        attempts: [],
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
async function pollTaskStatus(taskId, taskType = '2d-vto/earring') {
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

// PLAN A: Run earring task with specific parameters
async function runPlanA(scale, attemptNumber, isRightEar = true, location = [205, 905]) {
    console.log(`\n=== PLAN A Attempt ${attemptNumber} (scale=${scale}, right_ear=${isRightEar}) ===`);
    
    const body = {
        "src_file_url": "https://plugins-media.makeupar.com/strapi/assets/sample_Image_1_202b6bf6e6.jpg",
        "ref_file_urls": ["https://images.metmuseum.org/CRDImages/is/original/LC-15_95_129.jpg"],
        "source_info": { "name": "https://plugins-media.makeupar.com/strapi/assets/sample_Image_1_202b6bf6e6.jpg" },
        "object_infos": [{
            "name": "https://images.metmuseum.org/CRDImages/is/original/LC-15_95_129.jpg",
            "parameter": {
                "earring_need_remove_background": true,
                "earring_scale": scale,
                "earring_is_right_ear": isRightEar,
                "earring_wearing_location": location,
                "earring_occluded_type": 2,
                "earring_shadow_intensity": 0.15,
                "earring_ambient_light_intensity": 1.0
            }
        }]
    };
    
    // Create task
    const createResult = await makeApiCall('POST', '/s2s/v2.0/task/2d-vto/earring', body, `Create PLAN A task (scale=${scale})`);
    
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
    const pollResult = await pollTaskStatus(taskId);
    
    if (pollResult.taskStatus === 'success') {
        console.log('Task succeeded!');
        results.unitsUsed += 1;
        
        // Download image
        const ext = 'png';
        const filename = `a_earring_${scale}cm_attempt${attemptNumber}`;
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
            location,
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
            location,
            error: pollResult.taskStatus,
            pollResult
        };
    }
}

// Main execution
async function main() {
    console.log('=== EXECUTING PLAN A ===');
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
        
        // Check if we have enough budget
        const maxBudget = 8;
        const maxFailedAttempts = 8;
        console.log(`\nBudget constraints: Max ${maxBudget} units, Max ${maxFailedAttempts} failed attempts`);
        
        // PLAN A: Attempt 1 (right ear true, location [205, 905])
        console.log('\n=== PLAN A: Attempt 1 (right_ear=true, location=[205, 905]) ===');
        const attempt1 = await runPlanA(3.0, 1, true, [205, 905]);
        results.planA.attempts.push(attempt1);
        
        if (attempt1.success) {
            results.planA.success = true;
            results.planA.savedImages.push({
                scale: 3.0,
                path: attempt1.savedPath,
                filename: `a_earring_3cm.png`
            });
            
            // Now run with scale 6.0 using same successful parameters
            console.log('\n=== PLAN A: Running scale 6.0 with same successful parameters ===');
            const attemptScale6 = await runPlanA(6.0, 2, attempt1.isRightEar, attempt1.location);
            results.planA.attempts.push(attemptScale6);
            
            if (attemptScale6.success) {
                results.planA.savedImages.push({
                    scale: 6.0,
                    path: attemptScale6.savedPath,
                    filename: `a_earring_6cm.png`
                });
            }
        } else {
            // PLAN A: Attempt 2 (right ear false, location [878, 905])
            console.log('\n=== PLAN A: Attempt 2 (right_ear=false, location=[878, 905]) ===');
            const attempt2 = await runPlanA(3.0, 2, false, [878, 905]);
            results.planA.attempts.push(attempt2);
            
            if (attempt2.success) {
                results.planA.success = true;
                results.planA.savedImages.push({
                    scale: 3.0,
                    path: attempt2.savedPath,
                    filename: `a_earring_3cm.png`
                });
                
                // Now run with scale 6.0 using same successful parameters
                console.log('\n=== PLAN A: Running scale 6.0 with same successful parameters ===');
                const attemptScale6 = await runPlanA(6.0, 3, attempt2.isRightEar, attempt2.location);
                results.planA.attempts.push(attemptScale6);
                
                if (attemptScale6.success) {
                    results.planA.savedImages.push({
                        scale: 6.0,
                        path: attemptScale6.savedPath,
                        filename: `a_earring_6cm.png`
                    });
                }
            }
        }
        
        // Step 2: Check final credit
        console.log('\n=== STEP 2: Checking final credit balance ===');
        results.finalCredit = await checkCreditBalance('Final Credit Balance');
        
        // Calculate total elapsed time
        results.totalElapsedTime = (Date.now() - overallStartTime) / 1000;
        
        // Save results
        results.endTime = new Date().toISOString();
        const reportPath = path.join(OUTPUT_DIR, 'plan_a_results.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        
        console.log(`\n=== EXECUTION COMPLETE ===`);
        console.log(`Total elapsed time: ${results.totalElapsedTime.toFixed(2)}s`);
        console.log(`Units used: ${results.unitsUsed}`);
        console.log(`Failed attempts: ${results.failedAttempts}`);
        console.log(`Plan A success: ${results.planA.success}`);
        console.log(`Report saved to: ${reportPath}`);
        
        // Print summary
        console.log('\n=== SUMMARY ===');
        console.log('Saved images:');
        results.planA.savedImages.forEach(img => {
            console.log(`  ${img.filename}: ${img.path}`);
        });
        
    } catch (error) {
        console.error(`Unhandled error: ${error.message}`);
        results.error = error.message;
        results.endTime = new Date().toISOString();
        
        const reportPath = path.join(OUTPUT_DIR, 'plan_a_results.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    }
}

// Run main
main().catch(console.error);