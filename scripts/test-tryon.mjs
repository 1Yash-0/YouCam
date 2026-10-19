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
const outFd = fs.openSync(path.join(b2Dir, 'test.out.log'), 'w');
const errFd = fs.openSync(path.join(b2Dir, 'test.err.log'), 'w');

let child = null;

async function startServer() {
  console.log('Starting server on port 3101...');
  
  const nextBin = path.join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  child = spawn(process.execPath, [nextBin, 'start', '-p', '3101'], {
    cwd: webDir,
    env: { ...process.env, ADMIN_TOKEN: 'dev-admin-token' },
    stdio: ['ignore', outFd, errFd]
  });
  
  console.log(`Server started with PID: ${child.pid}`);
  
  // Wait for server to be ready
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch('http://localhost:3101/api/health');
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

async function testTryon() {
  // First upload a photo
  const formData = new FormData();
  const photoPath = path.join(__dirname, '..', 'outputs', 'b0', 'inputs', 'gen_face.png');
  const photoBuffer = fs.readFileSync(photoPath);
  const blob = new Blob([photoBuffer], { type: 'image/png' });
  formData.append('photo', blob, 'gen_face.png');
  
  const photoResponse = await fetch('http://localhost:3101/api/photo', {
    method: 'POST',
    body: formData
  });
  
  console.log('Photo upload status:', photoResponse.status);
  const photoData = await photoResponse.json();
  console.log('Photo upload response:', photoData);
  
  const photoId = photoData.photoId;
  
  // Now test tryon
  const tryonResponse = await fetch('http://localhost:3101/api/tryon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photoId,
      productId: 'gilded-teardrop',
      sizeCm: 3.0,
      ear: 'right',
      irisPx: 37
    })
  });
  
  console.log('\nTryon status:', tryonResponse.status);
  console.log('Tryon headers:', Object.fromEntries(tryonResponse.headers.entries()));
  
  const tryonText = await tryonResponse.text();
  console.log('Tryon response text:', tryonText);
  
  try {
    const tryonData = JSON.parse(tryonText);
    console.log('Tryon response JSON:', tryonData);
  } catch (err) {
    console.log('Could not parse as JSON');
  }
}

async function main() {
  try {
    await startServer();
    await testTryon();
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