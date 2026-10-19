#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webDir = path.join(__dirname, '..', 'web');
console.log('webDir:', webDir);

// Check if next binary exists
const nextBin = path.join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next');
console.log('nextBin:', nextBin);
console.log('Exists:', fs.existsSync(nextBin));

// Try to spawn server
console.log('\nTrying to spawn server...');
const child = spawn(process.execPath, [nextBin, 'start', '-p', '3100'], {
  cwd: webDir,
  env: { ...process.env, ADMIN_TOKEN: 'dev-admin-token' },
  stdio: ['ignore', 'pipe', 'pipe']
});

child.stdout.on('data', (data) => {
  console.log('Server stdout:', data.toString());
});

child.stderr.on('data', (data) => {
  console.log('Server stderr:', data.toString());
});

child.on('error', (err) => {
  console.log('Spawn error:', err);
});

child.on('exit', (code) => {
  console.log('Server exited with code:', code);
});

// Wait a bit then kill
setTimeout(() => {
  console.log('\nKilling server...');
  child.kill('SIGTERM');
  process.exit(0);
}, 5000);