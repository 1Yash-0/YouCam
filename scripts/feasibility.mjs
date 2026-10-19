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

// Logging
const LOG_FILE = path.join(__dirname, '..', 'outputs', 'b0', 'log.json');
let logEntries = [];

function logEntry(entry) {
    logEntries.push(entry);
    // Write immediately
    fs.writeFileSync(LOG_FILE, JSON.stringify(logEntries, null, 2));
}

// Download image from URL
async function downloadImage(url, outputPath) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to download image from ${url}: ${response.status}`);
            return false;
        }
        
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(buffer));
        console.log(`Downloaded image to ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`Error downloading image: ${error.message}`);
        return false;
    }
}

// Extract image URL from response
function findImageUrl(data) {
    // Check common patterns
    if (data?.results?.url) return data.results.url;
    if (data?.results?.[0]?.url) return data.results[0].url;
    if (data?.results?.[0]?.download_url) return data.results[0].download_url;
    if (data?.result?.url) return data.result.url;
    if (data?.result?.download_url) return data.result.download_url;
    
    // Look for any string field ending with image URL extensions
    function searchForUrl(obj) {
        if (typeof obj === 'string') {
            if (obj.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
                return obj;
            }
        } else if (Array.isArray(obj)) {
            for (const item of obj) {
                const found = searchForUrl(item);
                if (found) return found;
            }
        } else if (obj && typeof obj === 'object') {
            for (const key in obj) {
                const found = searchForUrl(obj[key]);
                if (found) return found;
            }
        }
        return null;
    }
    
    return searchForUrl(data);
}

// Generic task runner
async function runTask(endpointPath, body, label) {
    const startTime = Date.now();
    const url = `${BASE_URL}${endpointPath}`;
    
    console.log(`\n=== Running task: ${label} ===`);
    console.log(`Endpoint: ${endpointPath}`);
    console.log(`Body: ${JSON.stringify(body, null, 2)}`);
    
    // Initial POST to create task
    const createStart = Date.now();
    const createResponse = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    const createTime = (Date.now() - createStart) / 1000;
    const createStatus = createResponse.status;
    const createData = await createResponse.json().catch(() => ({}));
    
    // Log creation
    const createLog = {
        timestamp: new Date().toISOString(),
        label,
        type: 'creation',
        endpoint: endpointPath,
        body: body,
        status: createStatus,
        response: createData,
        elapsed: createTime
    };
    logEntry(createLog);
    
    console.log(`Creation status: ${createStatus}`);
    console.log(`Creation response: ${JSON.stringify(createData, null, 2)}`);
    console.log(`Creation time: ${createTime.toFixed(2)}s`);
    
    if (!createResponse.ok) {
        return {
            success: false,
            status: createStatus,
            data: createData,
            elapsed: createTime
        };
    }
    
    // Extract task ID
    const taskId = createData?.data?.task_id;
    if (!taskId) {
        console.error('No task_id in response');
        return {
            success: false,
            status: createStatus,
            data: createData,
            elapsed: createTime
        };
    }
    
    console.log(`Task ID: ${taskId}`);
    
    // Poll for completion
    const pollUrl = `${BASE_URL}${endpointPath}/${taskId}`;
    const maxPolls = 60;
    const pollInterval = 3000; // 3 seconds
    
    for (let i = 0; i < maxPolls; i++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const pollStart = Date.now();
        const pollResponse = await fetch(pollUrl, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const pollTime = (Date.now() - pollStart) / 1000;
        const pollStatus = pollResponse.status;
        const pollData = await pollResponse.json().catch(() => ({}));
        
        // Log poll
        const pollLog = {
            timestamp: new Date().toISOString(),
            label,
            type: 'poll',
            endpoint: `${endpointPath}/${taskId}`,
            poll: i + 1,
            status: pollStatus,
            response: pollData,
            elapsed: pollTime
        };
        logEntry(pollLog);
        
        const taskStatus = pollData?.data?.task_status;
        console.log(`Poll ${i + 1}: status=${taskStatus || 'unknown'}`);
        
        if (taskStatus === 'success' || taskStatus === 'error') {
            const totalElapsed = (Date.now() - startTime) / 1000;
            
            // Download image if found
            if (taskStatus === 'success') {
                const imageUrl = findImageUrl(pollData?.data);
                if (imageUrl) {
                    const ext = imageUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'jpg';
                    const outputPath = path.join(__dirname, '..', 'outputs', 'b0', `${label}.${ext}`);
                    
                    console.log(`Found image URL: ${imageUrl}`);
                    await downloadImage(imageUrl, outputPath);
                } else {
                    console.log('No image URL found in response');
                }
            }
            
            return {
                success: taskStatus === 'success',
                status: pollStatus,
                data: pollData,
                elapsed: totalElapsed,
                taskStatus
            };
        }
    }
    
    // Timeout
    const totalElapsed = (Date.now() - startTime) / 1000;
    console.error(`Timeout after ${maxPolls} polls`);
    
    return {
        success: false,
        status: 408,
        data: { error: 'Polling timeout' },
        elapsed: totalElapsed,
        taskStatus: 'timeout'
    };
}

// Free check functions
async function checkCredit() {
    console.log('\n=== Checking credit balance ===');
    const url = `${BASE_URL}/s2s/v1.0/client/credit`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(data, null, 2)}`);
    
    return { status: response.status, data };
}

async function checkFeatureCost() {
    console.log('\n=== Checking feature costs ===');
    const url = `${BASE_URL}/s2s/v2.0/credit/feature-cost`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${JSON.stringify(data, null, 2)}`);
        
        return { status: response.status, data };
    } catch (error) {
        console.log(`Error: ${error.message}`);
        return { status: 0, data: { error: error.message } };
    }
}

// Main function
async function main() {
    const testName = process.argv[2];
    
    if (!testName) {
        console.log('Usage: node scripts/feasibility.mjs <test_name>');
        console.log('Available tests: credit, feature-cost, earring_3cm, earring_6cm, earring_4_5cm');
        process.exit(1);
    }
    
    console.log(`Running test: ${testName}`);
    
    switch (testName) {
        case 'credit':
            await checkCredit();
            break;
        case 'feature-cost':
            await checkFeatureCost();
            break;
        default:
            console.log(`Unknown test: ${testName}`);
            process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

// Export for use in other scripts
export {
    parseEnvFile,
    runTask,
    checkCredit,
    checkFeatureCost,
    downloadImage
};