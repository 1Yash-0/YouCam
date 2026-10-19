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
console.log('API Base URL:', env.YOUCAM_API_BASE);
console.log('API Key exists:', !!env.YOUCAM_API_KEY);
console.log('Key first chars:', env.YOUCAM_API_KEY ? env.YOUCAM_API_KEY.substring(0, 10) + '...' : 'none');