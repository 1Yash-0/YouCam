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
const outFd = fs.openSync(path.join(b2Dir, 'server.out.log'), 'a'); // Append mode
const errFd = fs.openSync(path.join(b2Dir, 'server.err.log'), 'a'); // Append mode

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
  
  // Kill anything on port 3100 first
  try {
    spawnSync('taskkill', ['/F', '/IM', 'node.exe', '/T'], { stdio: 'ignore' });
  } catch (err) {
    // Ignore errors
  }
  
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

async function handleTryonResponse(response, stepLetter, description) {
  const data = await response.json();
  
  if (data.status === 'done') {
    // Cache hit
    results.push({
      step: stepLetter,
      status: 'PASS',
      message: `${description} - cache hit`,
      data: {
        cached: data.result.cached,
        unitsSpent: data.result.units,
        measurement: data.result.measurement
      }
    });
    console.log(JSON.stringify(results[results.length - 1]));
    return data.result;
  } else if (data.status === 'running' && data.jobId) {
    // Need to poll
    const jobId = data.jobId;
    console.log(`  Job created: ${jobId}, polling...`);
    
    // Poll for completion (max 40 x 3s = 120s)
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const pollResponse = await fetchWithTimeout(`http://localhost:3100/api/tryon/${jobId}`);
        const pollData = await pollResponse.json();
        
        if (pollData.status === 'done') {
          results.push({
            step: stepLetter,
            status: 'PASS',
            message: `${description} - completed after polling`,
            data: {
              cached: pollData.result.cached,
              unitsSpent: pollData.result.units,
              measurement: pollData.result.measurement,
              steps: pollData.steps
            }
          });
          console.log(JSON.stringify(results[results.length - 1]));
          return pollData.result;
        } else if (pollData.status === 'error') {
          throw new Error(`Job failed: ${pollData.code} - ${pollData.userMessage}`);
        } else if (pollData.status === 'running') {
          console.log(`  Poll ${i + 1}/40: ${pollData.step || 'running'}`);
        }
      } catch (err) {
        // Continue polling
      }
    }
    
    throw new Error('Job did not complete within 120 seconds');
  } else {
    throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  }
}

function truncateUrl(url) {
  if (url && url.length > 120) {
    return url.substring(0, 117) + '...';
  }
  return url;
}

async function main() {
  try {
    // Get initial health/units
    const initialHealth = await startServer();
    const initialUnits = initialHealth.units;
    console.log(`Initial units: ${initialUnits}`);
    
    // Step a: POST /api/photo
    console.log('\n=== Step a: Upload photo ===');
    const formData = new FormData();
    const photoPath = path.join(__dirname, '..', 'outputs', 'b0', 'inputs', 'gen_face.png');
    const photoBuffer = fs.readFileSync(photoPath);
    const blob = new Blob([photoBuffer], { type: 'image/png' });
    formData.append('photo', blob, 'gen_face.png');
    
    const photoResponse = await fetchWithTimeout('http://localhost:3100/api/photo', {
      method: 'POST',
      body: formData
    });
    
    if (photoResponse.status !== 200) {
      throw new Error(`Photo upload failed: ${photoResponse.status}`);
    }
    
    const photoData = await photoResponse.json();
    const photoId = photoData.photoId;
    results.push({
      step: 'a',
      status: 'PASS',
      message: 'Photo uploaded successfully',
      data: { photoId: photoId.substring(0, 16) + '...' }
    });
    console.log(JSON.stringify(results[results.length - 1]));
    
    // Step b: POST /api/tryon basic
    console.log('\n=== Step b: Basic try-on ===');
    const tryon1Response = await fetchWithTimeout('http://localhost:3100/api/tryon', {
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
    
    const result1 = await handleTryonResponse(tryon1Response, 'b', 'Basic try-on');
    
    // Step c: POST /api/tryon with lipstick
    console.log('\n=== Step c: Try-on with lipstick ===');
    const tryon2Response = await fetchWithTimeout('http://localhost:3100/api/tryon', {
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
    
    const result2 = await handleTryonResponse(tryon2Response, 'c', 'Try-on with lipstick');
    
    // Download image if available
    if (result2.imageUrl) {
      try {
        const imageUrl = result2.imageUrl.startsWith('http') ? result2.imageUrl : `http://localhost:3100${result2.imageUrl}`;
        const imageResponse = await fetchWithTimeout(imageUrl);
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
    
    // Step d: Repeat (c) - should be cached
    console.log('\n=== Step d: Repeat try-on with lipstick (cached) ===');
    const tryon3Response = await fetchWithTimeout('http://localhost:3100/api/tryon', {
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
    
    const result3 = await handleTryonResponse(tryon3Response, 'd', 'Cached try-on with lipstick');
    
    if (result3.units !== 0) {
      results.push({
        step: 'd-check',
        status: 'FAIL',
        message: `Expected 0 units spent for cached result, got ${result3.units}`,
        data: null
      });
      console.log(JSON.stringify(results[results.length - 1]));
    }
    
    // Step e: Repeat (b) - should be cached
    console.log('\n=== Step e: Repeat basic try-on (cached) ===');
    const tryon4Response = await fetchWithTimeout('http://localhost:3100/api/tryon', {
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
    
    const result4 = await handleTryonResponse(tryon4Response, 'e', 'Cached basic try-on');
    
    if (result4.units !== 0) {
      results.push({
        step: 'e-check',
        status: 'FAIL',
        message: `Expected 0 units spent for cached result, got ${result4.units}`,
        data: null
      });
      console.log(JSON.stringify(results[results.length - 1]));
    }
    
    // Step f: New photo for necklace
    console.log('\n=== Step f: Front photo for necklace ===');
    const formData2 = new FormData();
    const photoPath2 = path.join(__dirname, '..', 'outputs', 'probes', 'inputs', 'gen_face_front.png');
    const photoBuffer2 = fs.readFileSync(photoPath2);
    const blob2 = new Blob([photoBuffer2], { type: 'image/png' });
    formData2.append('photo', blob2, 'gen_face_front.png');
    
    const photoResponse2 = await fetchWithTimeout('http://localhost:3100/api/photo', {
      method: 'POST',
      body: formData2
    });
    
    if (photoResponse2.status !== 200) {
      results.push({
        step: 'f-photo',
        status: 'FAIL',
        message: `Photo upload failed: ${photoResponse2.status}`,
        data: null
      });
      console.log(JSON.stringify(results[results.length - 1]));
    } else {
      const photoData2 = await photoResponse2.json();
      const frontPhotoId = photoData2.photoId;
      results.push({
        step: 'f-photo',
        status: 'PASS',
        message: 'Front photo uploaded successfully',
        data: { photoId: frontPhotoId.substring(0, 16) + '...' }
      });
      console.log(JSON.stringify(results[results.length - 1]));
      
      // Necklace try-on
      console.log('\n=== Step f: Necklace try-on ===');
      const neckResponse = await fetchWithTimeout('http://localhost:3100/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: 'neck',
          photoId: frontPhotoId,
          productId: 'orb-chain'
        })
      });
      
      const neckResult = await handleTryonResponse(neckResponse, 'f-neck', 'Necklace try-on');
      
      // Download necklace image if available
      if (neckResult.imageUrl) {
        try {
          const imageUrl = neckResult.imageUrl.startsWith('http') ? neckResult.imageUrl : `http://localhost:3100${neckResult.imageUrl}`;
          const imageResponse = await fetchWithTimeout(imageUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          fs.writeFileSync(
            path.join(b2Dir, 'necklace.png'),
            Buffer.from(imageBuffer)
          );
          console.log(`Downloaded image to ${path.join(b2Dir, 'necklace.png')}`);
        } catch (err) {
          console.error('Failed to download necklace image:', err.message);
        }
      }
      
      // Should fail with sizeCm for neck flow
      console.log('\n=== Step f: Invalid neck request (should fail) ===');
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
      
      if (failResponse.status === 400) {
        results.push({
          step: 'f-invalid',
          status: 'PASS',
          message: 'Invalid neck request correctly rejected (400)',
          data: null
        });
      } else {
        results.push({
          step: 'f-invalid',
          status: 'FAIL',
          message: `Expected 400 for invalid neck request, got ${failResponse.status}`,
          data: null
        });
      }
      console.log(JSON.stringify(results[results.length - 1]));
    }
    
    // Step g: Recommendation APIs
    console.log('\n=== Step g: Recommendation APIs ===');
    try {
      // Metal recommendation 1
      const metal1Response = await fetchWithTimeout('http://localhost:3100/api/recommend/metal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skinHex: '#E8C1A8'
        })
      });
      
      const metal1Data = metal1Response.status === 200 ? await metal1Response.json() : null;
      
      // Metal recommendation 2
      const metal2Response = await fetchWithTimeout('http://localhost:3100/api/recommend/metal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skinHex: '#E8C1A8',
          zari: 'gold'
        })
      });
      
      const metal2Data = metal2Response.status === 200 ? await metal2Response.json() : null;
      
      // Lipstick recommendation
      const lipstickResponse = await fetchWithTimeout('http://localhost:3100/api/recommend/lipstick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skinHex: '#E8C1A8',
          outfitHex: '#1B4D3E'
        })
      });
      
      const lipstickData = lipstickResponse.status === 200 ? await lipstickResponse.json() : null;
      
      if (metal1Response.status === 200 && metal2Response.status === 200 && lipstickResponse.status === 200) {
        results.push({
          step: 'g',
          status: 'PASS',
          message: 'Recommendation APIs successful',
          data: {
            metal1: metal1Data?.metal,
            metal2: metal2Data?.metal,
            lipstick: lipstickData?.hex
          }
        });
      } else {
        results.push({
          step: 'g',
          status: 'FAIL',
          message: `Recommendation APIs failed: metal1=${metal1Response.status}, metal2=${metal2Response.status}, lipstick=${lipstickResponse.status}`,
          data: null
        });
      }
      console.log(JSON.stringify(results[results.length - 1]));
    } catch (err) {
      results.push({
        step: 'g',
        status: 'FAIL',
        message: `Recommendation APIs error: ${err.message}`,
        data: null
      });
      console.log(JSON.stringify(results[results.length - 1]));
    }
    
    // Step h: GET /api/hair/templates
    console.log('\n=== Step h: Hair templates ===');
    try {
      const hairResponse = await fetchWithTimeout('http://localhost:3100/api/hair/templates');
      if (hairResponse.status === 200) {
        const hairData = await hairResponse.json();
        const firstThree = Array.isArray(hairData) ? hairData.slice(0, 3) : [];
        results.push({
          step: 'h',
          status: 'PASS',
          message: 'Hair templates retrieved',
          data: {
            count: Array.isArray(hairData) ? hairData.length : 0,
            firstThree: firstThree.map(t => ({ id: t.id, title: t.title }))
          }
        });
      } else {
        results.push({
          step: 'h',
          status: 'FAIL',
          message: `Expected 200 for hair templates, got ${hairResponse.status}`,
          data: null
        });
      }
      console.log(JSON.stringify(results[results.length - 1]));
    } catch (err) {
      results.push({
        step: 'h',
        status: 'FAIL',
        message: `Hair templates error: ${err.message}`,
        data: null
      });
      console.log(JSON.stringify(results[results.length - 1]));
    }
    
    // Step i: Admin endpoints
    console.log('\n=== Step i: Admin endpoints ===');
    try {
      // POST /api/admin/products (no token) -> expect 401
      const adminResponse = await fetchWithTimeout('http://localhost:3100/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (adminResponse.status === 401) {
        results.push({
          step: 'i',
          status: 'PASS',
          message: 'Admin endpoint correctly requires token (401)',
          data: null
        });
      } else {
        results.push({
          step: 'i',
          status: 'FAIL',
          message: `Expected 401 for admin endpoint without token, got ${adminResponse.status}`,
          data: null
        });
      }
      console.log(JSON.stringify(results[results.length - 1]));
    } catch (err) {
      results.push({
        step: 'i',
        status: 'FAIL',
        message: `Admin endpoints error: ${err.message}`,
        data: null
      });
      console.log(JSON.stringify(results[results.length - 1]));
    }
    
    // Step j: POST /api/looks and GET it back
    console.log('\n=== Step j: Looks API ===');
    try {
      const looksResponse = await fetchWithTimeout('http://localhost:3100/api/looks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: 'ear',
          productId: 'gilded-teardrop',
          sizeCm: 4.5
        })
      });
      
      if (looksResponse.status === 201) {
        const looksData = await looksResponse.json();
        const lookId = looksData.lookId;
        
        // GET it back
        const getResponse = await fetchWithTimeout(`http://localhost:3100/api/looks/${lookId}`);
        
        if (getResponse.status === 200) {
          const lookData = await getResponse.json();
          results.push({
            step: 'j',
            status: 'PASS',
            message: 'Look created and retrieved',
            data: {
              lookId,
              flow: lookData.flow,
              productId: lookData.productId,
              sizeCm: lookData.sizeCm
            }
          });
        } else {
          results.push({
            step: 'j',
            status: 'FAIL',
            message: `Expected 200 for look retrieval, got ${getResponse.status}`,
            data: null
          });
        }
      } else {
        results.push({
          step: 'j',
          status: 'FAIL',
          message: `Expected 201 for look creation, got ${looksResponse.status}`,
          data: null
        });
      }
      console.log(JSON.stringify(results[results.length - 1]));
    } catch (err) {
      results.push({
        step: 'j',
        status: 'FAIL',
        message: `Looks API error: ${err.message}`,
        data: null
      });
      console.log(JSON.stringify(results[results.length - 1]));
    }
    
    // Step k: GET /api/sample
    console.log('\n=== Step k: Sample gallery ===');
    try {
      const sampleResponse = await fetchWithTimeout('http://localhost:3100/api/sample');
      if (sampleResponse.status === 200) {
        const sampleData = await sampleResponse.json();
        results.push({
          step: 'k',
          status: 'PASS',
          message: 'Sample gallery retrieved',
          data: {
            count: Array.isArray(sampleData) ? sampleData.length : 0
          }
        });
      } else {
        results.push({
          step: 'k',
          status: 'FAIL',
          message: `Expected 200 for sample endpoint, got ${sampleResponse.status}`,
          data: null
        });
      }
      console.log(JSON.stringify(results[results.length - 1]));
    } catch (err) {
      results.push({
        step: 'k',
        status: 'FAIL',
        message: `Sample gallery error: ${err.message}`,
        data: null
      });
      console.log(JSON.stringify(results[results.length - 1]));
    }
    
    // Step l: GET /api/health -> units before/after
    console.log('\n=== Step l: Final health check ===');
    try {
      const finalHealthResponse = await fetchWithTimeout('http://localhost:3100/api/health');
      if (finalHealthResponse.status === 200) {
        const finalHealthData = await finalHealthResponse.json();
        const finalUnits = finalHealthData.units;
        const unitsDiff = initialUnits - finalUnits;
        
        results.push({
          step: 'l',
          status: 'PASS',
          message: 'Health check completed',
          data: {
            unitsBefore: initialUnits,
            unitsAfter: finalUnits,
            unitsSpent: unitsDiff
          }
        });
        
        console.log(`Units before: ${initialUnits}`);
        console.log(`Units after: ${finalUnits}`);
        console.log(`Units spent: ${unitsDiff}`);
        
        if (unitsDiff > 6) {
          console.warn(`WARNING: Exceeded 6-unit budget! Spent ${unitsDiff} units`);
        } else {
          console.log(`OK: Within 6-unit budget (spent ${unitsDiff} units)`);
        }
      } else {
        results.push({
          step: 'l',
          status: 'FAIL',
          message: `Expected 200 for health endpoint, got ${finalHealthResponse.status}`,
          data: null
        });
      }
      console.log(JSON.stringify(results[results.length - 1]));
    } catch (err) {
      results.push({
        step: 'l',
        status: 'FAIL',
        message: `Health check error: ${err.message}`,
        data: null
      });
      console.log(JSON.stringify(results[results.length - 1]));
    }
    
  } catch (error) {
    console.error('Fatal error in smoke test:', error);
  } finally {
    cleanup(0);
  }
}

// Run the main function
main();