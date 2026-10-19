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

async function makeApiCall(method, endpoint, body = null) {
    const url = `${BASE_URL}${endpoint}`;
    
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
    
    console.log(`${method} ${endpoint}`);
    if (body) {
        console.log(`Body: ${JSON.stringify(body, null, 2)}`);
    }
    
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(data, null, 2)}`);
    
    return { status: response.status, data };
}

async function pollTask(taskId, maxPolls = 60, interval = 3000) {
    const endpoint = `/s2s/v2.0/task/2d-vto/earring/${taskId}`;
    
    for (let i = 0; i < maxPolls; i++) {
        await new Promise(resolve => setTimeout(resolve, interval));
        
        console.log(`\nPoll ${i + 1}:`);
        const result = await makeApiCall('GET', endpoint);
        
        const taskStatus = result.data?.data?.task_status;
        console.log(`Task status: ${taskStatus}`);
        
        if (taskStatus === 'success' || taskStatus === 'error') {
            return result;
        }
    }
    
    console.log('Polling timeout');
    return null;
}

async function runEarringTask(scale, earringIsRightEar) {
    console.log(`\n=== Running earring task (scale=${scale}, right_ear=${earringIsRightEar}) ===`);
    
    const body = {
        "src_file_url": "https://plugins-media.makeupar.com/strapi/assets/sample_Image_1_202b6bf6e6.jpg",
        "ref_file_urls": ["https://images.metmuseum.org/CRDImages/is/original/LC-15_95_129.jpg"],
        "source_info": { "name": "https://plugins-media.makeupar.com/strapi/assets/sample_Image_1_202b6bf6e6.jpg" },
        "object_infos": [{
            "name": "https://images.metmuseum.org/CRDImages/is/original/LC-15_95_129.jpg",
            "parameter": {
                "earring_need_remove_background": true,
                "earring_scale": scale,
                "earring_is_right_ear": earringIsRightEar,
                "earring_occluded_type": 0,
                "earring_shadow_intensity": 0.15,
                "earring_ambient_light_intensity": 1.0
            }
        }]
    };
    
    // Create task
    const createResult = await makeApiCall('POST', '/s2s/v2.0/task/2d-vto/earring', body);
    
    if (createResult.status !== 200) {
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
    const pollResult = await pollTask(taskId);
    
    if (!pollResult) {
        return null;
    }
    
    const taskStatus = pollResult.data?.data?.task_status;
    const success = taskStatus === 'success';
    
    return {
        success,
        taskStatus,
        result: pollResult,
        earring_is_right_ear: earringIsRightEar,
        scale
    };
}

async function main() {
    console.log('=== STEP 3: Earring task with scale=3.0 ===');
    
    // First attempt with right ear
    let result = await runEarringTask(3.0, true);
    
    if (!result) {
        console.error('Task failed');
        return;
    }
    
    // Check if we need to retry with left ear
    if (!result.success) {
        const errorMsg = JSON.stringify(result.result.data).toLowerCase();
        if (errorMsg.includes('detection') || errorMsg.includes('pose') || errorMsg.includes('earlobe')) {
            console.log('\nDetection/pose error detected, retrying with earring_is_right_ear=false');
            result = await runEarringTask(3.0, false);
        }
    }
    
    console.log('\n=== Final Result ===');
    console.log(`Success: ${result.success}`);
    console.log(`Task status: ${result.taskStatus}`);
    console.log(`Used right ear: ${result.earring_is_right_ear}`);
    
    if (result.success) {
        console.log('\nFull final JSON:');
        console.log(JSON.stringify(result.result.data, null, 2));
    }
}

main().catch(console.error);