import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webDir = path.join(__dirname, '..', 'web');
const outputsDir = path.join(__dirname, '..', 'outputs');
const b2Dir = path.join(outputsDir, 'b2');

// Setup log files
const outFd = fs.openSync(path.join(b2Dir, 'test2.out.log'), 'w');
const errFd = fs.openSync(path.join(b2Dir, 'test2.err.log'), 'w');

let child = null;

async function startServer() {
  console.log('Starting server on port 3102...');
  
  const nextBin = path.join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  child = spawn(process.execPath, [nextBin, 'start', '-p', '3102'], {
    cwd: webDir,
    env: { ...process.env, ADMIN_TOKEN: 'dev-admin-token' },
    stdio: ['ignore', outFd, errFd]
  });
  
  console.log(`Server started with PID: ${child.pid}`);
  
  // Wait for server to be ready
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch('http://localhost:3102/api/health');
      if (response.status === 200) {
        console.log('Server is ready!');
        return;
      }
    } catch (err) {
      // Not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Server did not become ready');
}

async function testTryonGet() {
  // Try to get a tryon result with a fake jobId
  const response = await fetch('http://localhost:3102/api/tryon/test-job-id');
  
  console.log('GET /api/tryon/test-job-id status:', response.status);
  console.log('Response text:', await response.text());
}

async function main() {
  try {
    await startServer();
    await testTryonGet();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (child && child.pid) {
      console.log(`\nKilling server process ${child.pid}...`);
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    }
    if (outFd) fs.closeSync(outFd);
    if (errFd) fs.closeSync(errFd);
  }
}

main();