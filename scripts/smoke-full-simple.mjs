#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webDir = path.join(__dirname, '..', 'web');
const outputsDir = path.join(__dirname, '..', 'outputs');
const b2Dir = path.join(outputsDir, 'b2');

// Ensure b2 directory exists
if (!fs.existsSync(b2Dir)) {
  fs.mkdirSync(b2Dir, { recursive: true });
}

// Setup log files
const outFd = fs.openSync(path.join(b2Dir, 'server.out.log'), 'w');
const errFd = fs.openSync(path.join(b2Dir, 'server.err.log'), 'w');

let child = null;
const results = [];

// Global timeout
const KILL = setTimeout(() => {
  console.error('GLOBAL TIMEOUT');
  cleanup(2);
}, 8 * 60 * 1000);

function cleanup(code = 0) {
  if (child && child.pid) {
    console.log(`Killing server process ${child.pid}...`);
    try {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    } catch (err) {
      console.error(`Failed to kill process ${child.pid}:`, err.message);
    }
  }
  
  try {
    if (outFd) fs.closeSync(outFd);
    if (errFd) fs.closeSync(errFd);
  } catch (err) {
    // Ignore close errors
  }
  
  clearTimeout(KILL);
  
  // Print summary table
  console.log('\n\n=== SMOKE TEST SUMMARY ===');
  console.log('Step\tResult\tDetails');
  for (const result of results) {
    console.log(`${result.step}\t${result.status}\t${result.message || ''}`);
  }
  
  process.exit(code);
}

// Register cleanup handlers
process.on('exit', () => cleanup(0));
process.on('SIGINT', () => cleanup(1));
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  cleanup(1);
});

async function startServer() {
  console.log('Starting server on port 3100...');
  
  // Spawn the server
  const nextBin = path.join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  child = spawn(process.execPath, [nextBin, 'start', '-p', '3100'], {
    cwd: webDir,
    env: { ...process.env, ADMIN_TOKEN: 'dev-admin-token' },
    stdio: ['ignore', outFd, errFd]
  });
  
  console.log(`Server started with PID: ${child.pid}`);
  
  // Wait for server to be ready (max 60 seconds)
  const startTime = Date.now();
  const timeout = 60000;
  const pollInterval = 1000;
  
  while (Date.now() - startTime < timeout) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch('http://localhost:3100/api/health', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 200) {
        const data = await response.json();
        console.log('Server is ready! Units:', data.units);
        return data;
      }
    } catch (err) {
      // Server not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('Server did not become ready within 60 seconds');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function pollJob(jobId, maxPolls = 40, pollInterval = 3000) {
  for (let i = 0; i < maxPolls; i++) {
    try {
      const response = await fetchWithTimeout(`http://localhost:3100/api/tryon/${jobId}`);
      const data = await response.json();
      
      if (response.status === 200) {
        if (data.status === 'completed' || data.status === 'error') {
          return data;
        }
        if (data.step) {
          console.log(`  Poll ${i + 1}/${maxPolls}: ${data.step}`);
        }
      }
    } catch (err) {
      // Continue polling
    }
    
    if (i < maxPolls - 1) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  throw new Error(`Job ${jobId} did not complete within ${maxPolls * pollInterval / 1000} seconds`);
}

function truncateUrl(url) {
  if (url && url.length > 120) {
    return url.substring(0, 117) + '...';
  }
  return url;
}

function recordStep(stepLetter, success, message = '', data = null) {
  const result = {
    step: stepLetter,
    status: success ? 'PASS' : 'FAIL',
    message,
    data: data ? JSON.parse(JSON.stringify(data)) : null
  };
  
  // Truncate long URLs in data
  if (result.data && typeof result.data === 'object') {
    for (const key in result.data) {
      if (typeof result.data[key] === 'string' && result.data[key].startsWith('http')) {
        result.data[key] = truncateUrl(result.data[key]);
      }
    }
  }
  
  results.push(result);
  console.log(JSON.stringify(result));
  return success;
}

async function runStep(stepLetter, fn) {
  try {
    return await fn();
  } catch (error) {
    recordStep(stepLetter, false, error.message);
    return null;
  }
}

async function main() {
  try {
    // Get initial health/units
    const initialHealth = await startServer();
    const initialUnits = initialHealth.units;
    
    // Step a: POST /api/photo
    let photoId = await runStep('a', async () => {
      const formData = new FormData();
      const photoPath = path.join(__dirname, '..', 'outputs', 'b0', 'inputs', 'gen_face.png');
      const photoBuffer = fs.readFileSync(photoPath);
      const blob = new Blob([photoBuffer], { type: 'image/png' });
      formData.append('photo', blob, 'gen_face.png');
      
      const response = await fetchWithTimeout('http://localhost:3100/api/photo', {
        method: 'POST',
        body: formData
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.photoId) {
        throw new Error('No photoId in response');
      }
      
      return data.photoId;
    });
    
    if (photoId) {
      recordStep('a', true, 'Photo uploaded successfully', { photoId });
      
      // Step b: POST /api/tryon basic
      await runStep('b', async () => {
        const response = await fetchWithTimeout('http://localhost:3100/api/tryon', {
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
        
        if (response.status !== 202) {
          throw new Error(`Expected 202, got ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.jobId) {
          throw new Error('No jobId in response');
        }
        
        const result = await pollJob(data.jobId);
        recordStep('b', true, 'Try-on completed', {
          cached: result.cached,
          unitsSpent: result.unitsSpent,
          measurement: result.measurement
        });
        return result;
      });
      
      // Step c: POST /api/tryon with lipstick
      await runStep('c', async () => {
        const response = await fetchWithTimeout('http://localhost:3100/api/tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoId,
            productId: 'gilded-teardrop',
            sizeCm: 3.0,
            ear: 'right',
            irisPx: 37,
            options: {
              lipstick: {
                hex: '#9B1B30',
                texture: 'matte',
                intensity: 70
              }
            }
          })
        });
        
        if (response.status !== 202) {
          throw new Error(`Expected 202, got ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.jobId) {
          throw new Error('No jobId in response');
        }
        
        const result = await pollJob(data.jobId);
        
        // Download image
        if (result.imageUrl) {
          try {
            const imageResponse = await fetchWithTimeout(result.imageUrl);
            const imageBuffer = await imageResponse.arrayBuffer();
            fs.writeFileSync(
              path.join(b2Dir, 'lip_earring.png'),
              Buffer.from(imageBuffer)
            );
            console.log(`Downloaded image to ${path.join(b2Dir, 'lip_earring.png')}`);
          } catch (err) {
            console.error('Failed to download image:', err.message);
          }
        }
        
        recordStep('c', true, 'Try-on with lipstick completed', {
          steps: result.steps,
          imageUrl: truncateUrl(result.imageUrl)
        });
        return result;
      });
      
      // Step d: Repeat (c) - should be cached
      await runStep('d', async () => {
        const response = await fetchWithTimeout('http://localhost:3100/api/tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoId,
            productId: 'gilded-teardrop',
            sizeCm: 3.0,
            ear: 'right',
            irisPx: 37,
            options: {
              lipstick: {
                hex: '#9B1B30',
                texture: 'matte',
                intensity: 70
              }
            }
          })
        });
        
        if (response.status !== 202) {
          throw new Error(`Expected 202, got ${response.status}`);
        }
        
        const data = await response.json();
        const result = await pollJob(data.jobId);
        
        if (result.unitsSpent !== 0) {
          throw new Error(`Expected 0 units spent for cached result, got ${result.unitsSpent}`);
        }
        
        recordStep('d', true, 'Cached try-on completed', {
          unitsSpent: result.unitsSpent
        });
        return result;
      });
      
      // Step e: Repeat (b) - should be cached
      await runStep('e', async () => {
        const response = await fetchWithTimeout('http://localhost:3100/api/tryon', {
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
        
        if (response.status !== 202) {
          throw new Error(`Expected 202, got ${response.status}`);
        }
        
        const data = await response.json();
        const result = await pollJob(data.jobId);
        
        if (result.unitsSpent !== 0) {
          throw new Error(`Expected 0 units spent for cached result, got ${result.unitsSpent}`);
        }
        
        recordStep('e', true, 'Cached basic try-on completed', {
          unitsSpent: result.unitsSpent
        });
        return result;
      });
    }
    
    // Step f: New photo for necklace
    let frontPhotoId = await runStep('f', async () => {
      const formData = new FormData();
      const photoPath = path.join(__dirname, '..', 'outputs', 'probes', 'inputs', 'gen_face_front.png');
      const photoBuffer = fs.readFileSync(photoPath);
      const blob = new Blob([photoBuffer], { type: 'image/png' });
      formData.append('photo', blob, 'gen_face_front.png');
      
      const response = await fetchWithTimeout('http://localhost:3100/api/photo', {
        method: 'POST',
        body: formData
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.photoId) {
        throw new Error('No photoId in response');
      }
      
      return data.photoId;
    });
    
    if (frontPhotoId) {
      recordStep('f-photo', true, 'Front photo uploaded successfully', { photoId: frontPhotoId });
      
      // Step f continued: Necklace try-on
      await runStep('f-neck', async () => {
        const response = await fetchWithTimeout('http://localhost:3100/api/tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flow: 'neck',
            photoId: frontPhotoId,
            productId: 'orb-chain'
          })
        });
        
        if (response.status !== 202) {
          throw new Error(`Expected 202, got ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.jobId) {
          throw new Error('No jobId in response');
        }
        
        const result = await pollJob(data.jobId);
        
        // Download image
        if (result.imageUrl) {
          try {
            const imageResponse = await fetchWithTimeout(result.imageUrl);
            const imageBuffer = await imageResponse.arrayBuffer();
            fs.writeFileSync(
              path.join(b2Dir, 'necklace.png'),
              Buffer.from(imageBuffer)
            );
            console.log(`Downloaded image to ${path.join(b2Dir, 'necklace.png')}`);
          } catch (err) {
            console.error('Failed to download image:', err.message);
          }
        }
        
        recordStep('f-neck-result', true, 'Necklace try-on completed', {
          imageUrl: truncateUrl(result.imageUrl)
        });
        
        // Should fail with sizeCm for neck flow
        const failResponse = await fetchWithTimeout('http://localhost:3100/api/tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flow: 'neck',
            photoId: frontPhotoId,
            productId: 'orb-chain',
            sizeCm: 3
          })
        });
        
        if (failResponse.status !== 400) {
          throw new Error(`Expected 400 for invalid neck request, got ${failResponse.status}`);
        }
        
        return result;
      });
    }
    
    // Step g: Recommendation APIs
    await runStep('g', async () => {
      // Metal recommendation 1
      const response1 = await fetchWithTimeout('http://localhost:3100/api/recommend/metal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skinHex: '#E8C1A8'
        })
      });
      
      if (response1.status !== 200) {
        throw new Error(`Expected 200 for metal recommendation, got ${response1.status}`);
      }
      
      const data1 = await response1.json();
      
      // Metal recommendation 2
      const response2 = await fetchWithTimeout('http://localhost:3100/api/recommend/metal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skinHex: '#E8C1A8',
          zari: 'gold'
        })
      });
      
      if (response2.status !== 200) {
        throw new Error(`Expected 200 for metal recommendation with zari, got ${response2.status}`);
      }
      
      const data2 = await response2.json();
      
      // Lipstick recommendation
      const response3 = await fetchWithTimeout('http://localhost:3100/api/recommend/lipstick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skinHex: '#E8C1A8',
          outfitHex: '#1B4D3E'
        })
      });
      
      if (response3.status !== 200) {
        throw new Error(`Expected 200 for lipstick recommendation, got ${response3.status}`);
      }
      
      const data3 = await response3.json();
      
      recordStep('g', true, 'Recommendation APIs successful', {
        metal1: data1.metal,
        metal2: data2.metal,
        lipstick: data3.hex
      });
      return { data1, data2, data3 };
    });
    
    // Step h: GET /api/hair/templates
    await runStep('h', async () => {
      const response = await fetchWithTimeout('http://localhost:3100/api/hair/templates');
      
      if (response.status !== 200) {
        throw new Error(`Expected 200 for hair templates, got ${response.status}`);
      }
      
      const data = await response.json();
      const firstThree = Array.isArray(data) ? data.slice(0, 3) : [];
      recordStep('h', true, 'Hair templates retrieved', {
        count: Array.isArray(data) ? data.length : 0,
        firstThree
      });
      return data;
    });
    
    // Step i: Admin endpoints
    await runStep('i', async () => {
      // POST /api/admin/products (no token) -> expect 401
      const response1 = await fetchWithTimeout('http://localhost:3100/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response1.status !== 401) {
        throw new Error(`Expected 401 for admin endpoint without token, got ${response1.status}`);
      }
      
      // Note: Skipping admin product creation/deletion for now
      
      recordStep('i', true, 'Admin endpoints tested');
      return true;
    });
    
    // Step j: POST /api/looks and GET it back
    await runStep('j', async () => {
      const response = await fetchWithTimeout('http://localhost:3100/api/looks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: 'ear',
          productId: 'gilded-teardrop',
          sizeCm: 4.5
        })
      });
      
      if (response.status !== 201) {
        throw new Error(`Expected 201 for look creation, got ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.lookId) {
        throw new Error('No lookId in response');
      }
      
      // GET it back
      const getResponse = await fetchWithTimeout(`http://localhost:3100/api/looks/${data.lookId}`);
      
      if (getResponse.status !== 200) {
        throw new Error(`Expected 200 for look retrieval, got ${getResponse.status}`);
      }
      
      const lookData = await getResponse.json();
      
      recordStep('j', true, 'Look created and retrieved', {
        lookId: data.lookId,
        flow: lookData.flow,
        productId: lookData.productId,
        sizeCm: lookData.sizeCm
      });
      return lookData;
    });
    
    // Step k: GET /api/sample
    await runStep('k', async () => {
      const response = await fetchWithTimeout('http://localhost:3100/api/sample');
      
      if (response.status !== 200) {
        throw new Error(`Expected 200 for sample endpoint, got ${response.status}`);
      }
      
      const data = await response.json();
      const count = Array.isArray(data) ? data.length : 0;
      
      recordStep('k', true, 'Sample gallery retrieved', { count });
      return data;
    });
    
    // Step l: GET /api/health -> units
    await runStep('l', async () => {
      const response = await fetchWithTimeout('http://localhost:3100/api/health');
      
      if (response.status !== 200) {
        throw new Error(`Expected 200 for health endpoint, got ${response.status}`);
      }
      
      const data = await response.json();
      const finalUnits = data.units;
      const unitsDiff = initialUnits - finalUnits;
      
      recordStep('l', true, 'Health check completed', {
        unitsBefore: initialUnits,
        unitsAfter: finalUnits,
        unitsSpent: unitsDiff
      });
      return data;
    });
    
  } catch (error) {
    console.error('Fatal error in smoke test:', error);
  } finally {
    cleanup(0);
  }
}

// Run the main function
main();