#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Results storage
const results = {
    startTime: new Date().toISOString(),
    steps: {},
    finalReport: {}
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
    
    console.log(`\n${label}`);
    console.log(`${method} ${endpoint}`);
    
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

// Step 1: Check credit balance
async function step1() {
    console.log('\n=== STEP 1: Checking credit balance ===');
    const result = await makeApiCall('GET', '/s2s/v1.0/client/credit', null, 'Credit Balance');
    
    results.steps.step1 = result;
    
    if (result.status === 401) {
        console.error('401 Unauthorized - API key rejected. Stopping.');
        return false;
    }
    
    console.log(`\nInitial balance:`);
    result.data.results?.forEach(token => {
        console.log(`  ${token.type}: ${token.amount_dec} units (expires: ${new Date(token.expiry).toISOString()})`);
    });
    
    return true;
}

// Step 2: Get feature costs
async function step2() {
    console.log('\n=== STEP 2: Getting feature costs ===');
    
    const keywords = ['earring', 'necklace', 'makeup', 'hair-transfer', 'image', 'sod'];
    const matchingEntries = [];
    
    const result = await makeApiCall('GET', '/s2s/v2.0/credit/feature-cost?page_size=20', null, 'Feature Costs');
    
    if (!result.success) {
        console.error('Failed to get feature costs');
        return false;
    }
    
    const skus = result.data?.result?.skus || [];
    
    // Filter matching entries
    skus.forEach(sku => {
        const runTaskUrl = sku.run_task_url || '';
        const matches = keywords.some(keyword => 
            runTaskUrl.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (matches) {
            matchingEntries.push({
                description: sku.description,
                amount: sku.amount,
                unit: sku.unit,
                run_task_url: sku.run_task_url
            });
        }
    });
    
    console.log(`\nFound ${matchingEntries.length} matching entries:`);
    matchingEntries.forEach((entry, i) => {
        console.log(`${i + 1}. ${entry.description}`);
        console.log(`   Amount: ${entry.amount} ${entry.unit}`);
        console.log(`   URL: ${entry.run_task_url}`);
    });
    
    results.steps.step2 = {
        totalEntries: skus.length,
        matchingEntries,
        fullResponse: result.data
    };
    
    return true;
}

// Run earring task with retry logic
async function runEarringTaskWithRetry(scale, label) {
    console.log(`\n=== ${label}: Running earring task (scale=${scale}) ===`);
    
    let attempt = 1;
    let useRightEar = true;
    
    while (attempt <= 2) {
        console.log(`\nAttempt ${attempt}: earring_is_right_ear=${useRightEar}`);
        
        const body = {
            "src_file_url": "https://plugins-media.makeupar.com/strapi/assets/sample_Image_1_202b6bf6e6.jpg",
            "ref_file_urls": ["https://images.metmuseum.org/CRDImages/is/original/LC-15_95_129.jpg"],
            "source_info": { "name": "https://plugins-media.makeupar.com/strapi/assets/sample_Image_1_202b6bf6e6.jpg" },
            "object_infos": [{
                "name": "https://images.metmuseum.org/CRDImages/is/original/LC-15_95_129.jpg",
                "parameter": {
                    "earring_need_remove_background": true,
                    "earring_scale": scale,
                    "earring_is_right_ear": useRightEar,
                    "earring_occluded_type": 0,
                    "earring_shadow_intensity": 0.15,
                    "earring_ambient_light_intensity": 1.0
                }
            }]
        };
        
        // Create task
        const createResult = await makeApiCall('POST', '/s2s/v2.0/task/2d-vto/earring', body, 'Create Task');
        
        if (!createResult.success) {
            console.error('Task creation failed');
            return null;
        }
        
        const taskId = createResult.data?.data?.task_id;
        if (!taskId) {
            console.error('No task_id in response');
            return null;
        }
        
        console.log(`Task ID: ${taskId}`);
        
        // Poll for completion
        const pollEndpoint = `/s2s/v2.0/task/2d-vto/earring/${taskId}`;
        const maxPolls = 60;
        const pollInterval = 3000;
        
        for (let i = 0; i < maxPolls; i++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            
            const pollResult = await makeApiCall('GET', pollEndpoint, null, `Poll ${i + 1}`);
            
            if (!pollResult.success) {
                continue;
            }
            
            const taskStatus = pollResult.data?.data?.task_status;
            console.log(`Poll ${i + 1}: status=${taskStatus || 'unknown'}`);
            
            if (taskStatus === 'success' || taskStatus === 'error') {
                // Check if we should retry with different ear
                if (taskStatus === 'error') {
                    const errorMsg = JSON.stringify(pollResult.data).toLowerCase();
                    if ((errorMsg.includes('detection') || errorMsg.includes('pose') || errorMsg.includes('earlobe')) && attempt === 1 && useRightEar) {
                        console.log('Detection/pose error detected, retrying with earring_is_right_ear=false');
                        useRightEar = false;
                        attempt++;
                        break; // Break polling loop to retry
                    }
                }
                
                // Task completed (success or final error)
                return {
                    attempt,
                    earring_is_right_ear: useRightEar,
                    scale,
                    result: pollResult,
                    taskStatus,
                    final: taskStatus === 'success' || (taskStatus === 'error' && attempt >= 2)
                };
            }
        }
        
        console.error('Polling timeout');
        return null;
    }
    
    return null;
}

// Download image
async function downloadImageFromResult(resultData, filename) {
    // Simple URL extraction
    const data = resultData.data?.data;
    if (!data) return null;
    
    // Try to find image URL
    let imageUrl = null;
    
    if (data.results?.url) imageUrl = data.results.url;
    if (data.results?.[0]?.url) imageUrl = data.results[0].url;
    if (data.result?.url) imageUrl = data.result.url;
    
    if (!imageUrl) {
        console.log('No image URL found in result');
        return null;
    }
    
    console.log(`Found image URL: ${imageUrl}`);
    
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error(`Failed to download image: ${response.status}`);
            return null;
        }
        
        const buffer = await response.arrayBuffer();
        const ext = imageUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'jpg';
        const outputPath = path.join(OUTPUT_DIR, `${filename}.${ext}`);
        
        fs.writeFileSync(outputPath, Buffer.from(buffer));
        console.log(`Downloaded to: ${outputPath}`);
        
        return outputPath;
    } catch (error) {
        console.error(`Download error: ${error.message}`);
        return null;
    }
}

// Main execution
async function main() {
    console.log('=== B0 Task Execution ===');
    console.log(`Start time: ${results.startTime}`);
    console.log(`API Base: ${BASE_URL}`);
    
    try {
        // Step 1
        if (!await step1()) {
            return;
        }
        
        // Step 2
        await step2();
        
        // Step 3: Scale 3.0
        const step3Result = await runEarringTaskWithRetry(3.0, 'STEP 3');
        results.steps.step3 = step3Result;
        
        if (!step3Result || step3Result.taskStatus !== 'success') {
            console.log('\nStep 3 failed, skipping steps 4 and 5');
        } else {
            // Download result
            const outputPath3 = await downloadImageFromResult(step3Result.result, 'earring_3cm');
            if (outputPath3) {
                results.steps.step3.outputPath = outputPath3;
            }
            
            // Step 4: Scale 6.0 (same ear value)
            const step4Result = await runEarringTaskWithRetry(6.0, 'STEP 4');
            results.steps.step4 = step4Result;
            
            if (step4Result && step4Result.taskStatus === 'success') {
                const outputPath6 = await downloadImageFromResult(step4Result.result, 'earring_6cm');
                if (outputPath6) {
                    results.steps.step4.outputPath = outputPath6;
                }
                
                // Step 5: Scale 4.5 (same ear value)
                const step5Result = await runEarringTaskWithRetry(4.5, 'STEP 5');
                results.steps.step5 = step5Result;
                
                if (step5Result && step5Result.taskStatus === 'success') {
                    const outputPath45 = await downloadImageFromResult(step5Result.result, 'earring_4_5cm');
                    if (outputPath45) {
                        results.steps.step5.outputPath = outputPath45;
                    }
                }
            }
        }
        
        // Step 6: Analyze differences (simplified)
        console.log('\n=== STEP 6: Image Analysis ===');
        console.log('Note: Full pixel analysis requires image processing library');
        console.log('Checking available output files...');
        
        const outputs = [
            { label: '3.0cm', path: results.steps.step3?.outputPath },
            { label: '6.0cm', path: results.steps.step4?.outputPath },
            { label: '4.5cm', path: results.steps.step5?.outputPath }
        ];
        
        outputs.forEach(output => {
            if (output.path && fs.existsSync(output.path)) {
                console.log(`Found: ${output.label} -> ${output.path}`);
                // In a real implementation, you would use an image library here
            } else {
                console.log(`Missing: ${output.label}`);
            }
        });
        
        // Step 7: Final credit check
        console.log('\n=== STEP 7: Final credit balance ===');
        const finalCredit = await makeApiCall('GET', '/s2s/v1.0/client/credit', null, 'Final Credit');
        results.steps.step7 = finalCredit;
        
        // Save results
        results.endTime = new Date().toISOString();
        const reportPath = path.join(OUTPUT_DIR, 'b0_execution_results.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        
        console.log(`\n=== EXECUTION COMPLETE ===`);
        console.log(`Report saved to: ${reportPath}`);
        
    } catch (error) {
        console.error(`Unhandled error: ${error.message}`);
        results.error = error.message;
        results.endTime = new Date().toISOString();
        
        const reportPath = path.join(OUTPUT_DIR, 'b0_execution_results.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    }
}

// Run main
main().catch(console.error);