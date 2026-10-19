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

const env = parseEnvFile(path.join(__dirname, '..', '.env.local'));
const API_KEY = env.YOUCAM_API_KEY;
const BASE_URL = env.YOUCAM_API_BASE;

console.log('=== Checking API ===');
console.log(`Node version: ${process.version}`);
console.log(`Base URL: ${BASE_URL}`);
console.log(`API Key exists: ${!!API_KEY}`);

async function checkEndpoint(endpoint) {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`\nChecking: ${endpoint}`);
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Status: ${response.status}`);
        const data = await response.json();
        console.log(`Response: ${JSON.stringify(data, null, 2)}`);
        
        return { status: response.status, data };
    } catch (error) {
        console.log(`Error: ${error.message}`);
        return { status: 0, data: { error: error.message } };
    }
}

async function main() {
    console.log('\n--- STEP 3: Free checks ---');
    
    // Check credit
    const credit = await checkEndpoint('/s2s/v1.0/client/credit');
    
    if (credit.status === 401) {
        console.error('\nAPI key rejected (401). Stopping.');
        process.exit(1);
    }
    
    // Check feature cost
    const featureCost = await checkEndpoint('/s2s/v2.0/credit/feature-cost');
    
    console.log('\n--- Free checks completed ---');
}

main().catch(console.error);