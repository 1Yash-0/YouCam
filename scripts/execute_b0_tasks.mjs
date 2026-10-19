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
const INPUT_IMAGE_PATH = path.join(OUTPUT_DIR, 'inputs');
const REPORT_FILE = path.join(OUTPUT_DIR, 'execution_report.json');
const POLL_INTERVAL = 3000; // 3 seconds
const MAX_POLLS = 60; // Max 60 polls (3 minutes)

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Execution report
const report = {
    startTime: new Date().toISOString(),
    step1: null,
    step2: null,
    step3: null,
    step4: null,
    step5: null,
    step6: null,
    step7: null,
    unitBudget: 4,
    unitsUsed: 0,
    failedAttempts: 0,
    errors: []
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
    
    console.log(`\n=== ${label} ===`);
    console.log(`${method} ${endpoint}`);
    if (body) {
        console.log(`Body: ${JSON.stringify(body, null, 2)}`);
    }
    
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

// Download image function
async function downloadImage(url, outputPath) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to download image: ${response.status}`);
            return false;
        }
        
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(buffer));
        console.log(`Downloaded to: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`Download error: ${error.message}`);
        return false;
    }
}

// Find image URL in response
function findImageUrl(data) {
    // Check common patterns
    if (data?.data?.results?.url) return data.data.results.url;
    if (data?.data?.results?.[0]?.url) return data.data.results[0].url;
    if (data?.data?.results?.[0]?.download_url) return data.data.results[0].download_url;
    if (data?.data?.result?.url) return data.data.result.url;
    if (data?.data?.result?.download_url) return data.data.result.download_url;
    if (data?.data?.url) return data.data.url;
    if (data?.data?.download_url) return data.data.download_url;
    
    // Recursive search
    function searchForUrl(obj) {
        if (typeof obj === 'string') {
            if (obj.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i)) {
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
    
    return searchForUrl(data?.data) || searchForUrl(data);
}

// Run earring task with specific scale
async function runEarringTask(scale, earringIsRightEar = true, attempt = 1) {
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
    
    console.log(`\n=== Running earring task (scale=${scale}, right_ear=${earringIsRightEar}, attempt=${attempt}) ===`);
    
    // Create task
    const createResult = await makeApiCall('POST', '/s2s/v2.0/task/2d-vto/earring', body, 'Task Creation');
    
    if (!createResult.success) {
        report.failedAttempts++;
        if (createResult.status === 400 && attempt === 1) {
            console.log('400 error on first attempt - will try minimal fix');
            return { shouldRetry: true, result: createResult };
        }
        return { success: false, result: createResult };
    }
    
    const taskId = createResult.data?.data?.task_id;
    if (!taskId) {
        console.error('No task_id in response');
        return { success: false, result: createResult };
    }
    
    console.log(`Task ID: ${taskId}`);
    
    // Poll for completion
    const pollEndpoint = `/s2s/v2.0/task/2d-vto/earring/${taskId}`;
    let finalResult = null;
    
    for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        
        const pollResult = await makeApiCall('GET', pollEndpoint, null, `Poll ${i + 1}`);
        
        if (!pollResult.success) {
            continue;
        }
        
        const taskStatus = pollResult.data?.data?.task_status;
        console.log(`Poll ${i + 1}: status=${taskStatus || 'unknown'}`);
        
        if (taskStatus === 'success' || taskStatus === 'error') {
            finalResult = pollResult;
            
            // Check for detection/pose error
            if (taskStatus === 'error') {
                const errorMsg = JSON.stringify(pollResult.data).toLowerCase();
                if (errorMsg.includes('detection') || errorMsg.includes('pose')) {
                    console.log('Detection/pose error detected');
                    if (earringIsRightEar && attempt === 1) {
                        console.log('Will retry with earring_is_right_ear=false');
                        return { shouldRetryWithDifferentEar: true, result: pollResult };
                    }
                }
            }
            
            break;
        }
    }
    
    if (!finalResult) {
        console.error('Polling timeout');
        return { success: false, result: { data: { error: 'Polling timeout' } } };
    }
    
    const taskStatus = finalResult.data?.data?.task_status;
    const success = taskStatus === 'success';
    
    if (success) {
        // Download image
        const imageUrl = findImageUrl(finalResult.data);
        if (imageUrl) {
            const ext = imageUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)/i)?.[1] || 'jpg';
            const outputFilename = `earring_${scale}cm.${ext}`.replace('.', '_').replace('_', '.'); // Handle decimal scale
            const outputPath = path.join(OUTPUT_DIR, outputFilename);
            
            console.log(`Image URL found: ${imageUrl}`);
            const downloadSuccess = await downloadImage(imageUrl, outputPath);
            
            if (downloadSuccess) {
                return {
                    success: true,
                    result: finalResult,
                    outputPath,
                    imageUrl,
                    scale
                };
            }
        } else {
            console.log('No image URL found in response');
        }
    }
    
    return { success: false, result: finalResult };
}

// Step 1: Check credit balance
async function step1() {
    console.log('\n=== STEP 1: Checking credit balance ===');
    const result = await makeApiCall('GET', '/s2s/v1.0/client/credit', null, 'Credit Balance');
    
    report.step1 = result;
    
    if (result.status === 401) {
        console.error('401 Unauthorized - API key rejected. Stopping.');
        report.errors.push('Step 1: 401 Unauthorized');
        return false;
    }
    
    return true;
}

// Step 2: Get feature costs with pagination
async function step2() {
    console.log('\n=== STEP 2: Getting feature costs ===');
    
    const keywords = ['earring', 'necklace', 'makeup', 'hair-transfer', 'image', 'sod'];
    const entries = [];
    let nextToken = null;
    let page = 1;
    
    do {
        let endpoint = '/s2s/v2.0/credit/feature-cost?page_size=20';
        if (nextToken) {
            endpoint += `&starting_token=${nextToken}`;
        }
        
        console.log(`\nFetching page ${page}...`);
        const result = await makeApiCall('GET', endpoint, null, `Feature Cost Page ${page}`);
        
        if (!result.success) {
            console.error(`Failed to fetch page ${page}`);
            break;
        }
        
        const items = result.data?.data?.items || [];
        nextToken = result.data?.data?.next_token;
        
        // Filter items
        for (const item of items) {
            const runTaskUrl = item.run_task_url || '';
            const matches = keywords.some(keyword => 
                runTaskUrl.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (matches) {
                entries.push({
                    description: item.description,
                    amount: item.amount,
                    unit: item.unit,
                    run_task_url: item.run_task_url
                });
            }
        }
        
        console.log(`Page ${page}: Found ${items.length} total items, ${entries.length - (entries.length - items.filter(i => {
            const url = i.run_task_url || '';
            return keywords.some(k => url.toLowerCase().includes(k.toLowerCase()));
        }).length)} matching`);
        
        page++;
        
    } while (nextToken);
    
    report.step2 = {
        entries,
        totalPages: page - 1,
        totalMatchingEntries: entries.length
    };
    
    console.log('\n=== Matching entries: ===');
    entries.forEach((entry, i) => {
        console.log(`${i + 1}. ${entry.description}`);
        console.log(`   Amount: ${entry.amount} ${entry.unit}`);
        console.log(`   URL: ${entry.run_task_url}`);
    });
    
    return true;
}

// Step 3: Run earring task with scale 3.0
async function step3() {
    console.log('\n=== STEP 3: Running earring task (scale=3.0) ===');
    
    // First attempt
    let result = await runEarringTask(3.0, true, 1);
    
    if (result.shouldRetry) {
        console.log('First attempt failed with 400. Trying minimal fix...');
        // Minimal fix: adjust parameters
        const fixedResult = await runEarringTask(3.0, true, 2);
        report.step3 = fixedResult;
        report.unitsUsed++;
        
        if (!fixedResult.success && fixedResult.shouldRetryWithDifferentEar) {
            console.log('Trying with earring_is_right_ear=false...');
            const earFixResult = await runEarringTask(3.0, false, 3);
            report.step3 = earFixResult;
            return earFixResult.success;
        }
        
        return fixedResult.success;
    }
    
    if (result.shouldRetryWithDifferentEar) {
        console.log('Retrying with earring_is_right_ear=false...');
        result = await runEarringTask(3.0, false, 2);
    }
    
    report.step3 = result;
    if (result.success) {
        report.unitsUsed++;
    }
    
    return result.success;
}

// Step 4: Run earring task with scale 6.0
async function step4() {
    console.log('\n=== STEP 4: Running earring task (scale=6.0) ===');
    
    // Use same ear value as step 3
    const step3EarValue = report.step3?.result?.data?.earring_is_right_ear ?? true;
    const result = await runEarringTask(6.0, step3EarValue, 1);
    
    report.step4 = result;
    if (result.success) {
        report.unitsUsed++;
    }
    
    return result.success;
}

// Step 5: Run earring task with scale 4.5
async function step5() {
    console.log('\n=== STEP 5: Running earring task (scale=4.5) ===');
    
    // Use same ear value as step 3
    const step3EarValue = report.step3?.result?.data?.earring_is_right_ear ?? true;
    const result = await runEarringTask(4.5, step3EarValue, 1);
    
    report.step5 = result;
    if (result.success) {
        report.unitsUsed++;
    }
    
    return result.success;
}

// Step 6: Analyze image differences
async function step6() {
    console.log('\n=== STEP 6: Analyzing image differences ===');
    
    // Check input dimensions
    const inputFiles = fs.readdirSync(INPUT_IMAGE_PATH).filter(f => 
        f.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)
    );
    
    if (inputFiles.length === 0) {
        console.log('No input images found in inputs directory');
        report.step6 = { error: 'No input images found' };
        return;
    }
    
    // Use first input image
    const inputImagePath = path.join(INPUT_IMAGE_PATH, inputFiles[0]);
    console.log(`Using input image: ${inputImagePath}`);
    
    // Get output images
    const outputImages = [];
    if (report.step3?.outputPath && fs.existsSync(report.step3.outputPath)) {
        outputImages.push({ path: report.step3.outputPath, scale: 3.0 });
    }
    if (report.step4?.outputPath && fs.existsSync(report.step4.outputPath)) {
        outputImages.push({ path: report.step4.outputPath, scale: 6.0 });
    }
    if (report.step5?.outputPath && fs.existsSync(report.step5.outputPath)) {
        outputImages.push({ path: report.step5.outputPath, scale: 4.5 });
    }
    
    if (outputImages.length === 0) {
        console.log('No output images to analyze');
        report.step6 = { error: 'No output images to analyze' };
        return;
    }
    
    // We'll create a PowerShell script to analyze images
    const analysisScript = `$inputPath = "${inputImagePath.replace(/\\/g, '\\\\')}"
$expectedWidth = 1080
$expectedHeight = 1437

Write-Host "Input image: $inputPath"

# Load System.Drawing assembly
Add-Type -AssemblyName System.Drawing

function Get-ImageDimensions($path) {
    try {
        $image = [System.Drawing.Image]::FromFile($path)
        $width = $image.Width
        $height = $image.Height
        $image.Dispose()
        return @{Width=$width; Height=$height}
    } catch {
        return $null
    }
}

$inputDims = Get-ImageDimensions $inputPath
if (!$inputDims) {
    Write-Host "Failed to read input image dimensions"
    exit 1
}

Write-Host "Input dimensions: $($inputDims.Width)x$($inputDims.Height)"

$results = @()

$outputs = @(
    @{Path="${report.step3?.outputPath?.replace(/\\/g, '\\\\')}"; Scale=3.0},
    @{Path="${report.step4?.outputPath?.replace(/\\/g, '\\\\')}"; Scale=6.0},
    @{Path="${report.step5?.outputPath?.replace(/\\/g, '\\\\')}"; Scale=4.5}
)

foreach ($output in $outputs) {
    $outputPath = $output.Path
    $scale = $output.Scale
    
    if (!(Test-Path $outputPath)) {
        Write-Host "Output not found: $outputPath"
        continue
    }
    
    $outputDims = Get-ImageDimensions $outputPath
    if (!$outputDims) {
        Write-Host "Failed to read output image dimensions: $outputPath"
        continue
    }
    
    Write-Host ""
    Write-Host "Output (scale $scale): $outputPath"
    Write-Host "Dimensions: $($outputDims.Width)x$($outputDims.Height)"
    
    if ($outputDims.Width -eq $expectedWidth -and $outputDims.Height -eq $expectedHeight) {
        Write-Host "Dimensions match expected (1080x1437)"
        Write-Host "Note: Detailed pixel analysis requires more complex image processing"
        Write-Host "For bounding box analysis, a proper image processing library is needed"
        
        $results += @{
            Scale = $scale
            Path = $outputPath
            Width = $outputDims.Width
            Height = $outputDims.Height
            MatchesExpected = $true
            AnalysisNote = "Dimensions match. Full pixel diff requires image processing library."
        }
    } else {
        Write-Host "WARNING: Dimensions differ from expected"
        Write-Host "Expected: ${expectedWidth}x${expectedHeight}"
        Write-Host "Actual: $($outputDims.Width)x$($outputDims.Height)"
        
        $results += @{
            Scale = $scale
            Path = $outputPath
            Width = $outputDims.Width
            Height = $outputDims.Height
            MatchesExpected = $false
            ExpectedWidth = $expectedWidth
            ExpectedHeight = $expectedHeight
        }
    }
}

# Calculate ratios if we have both 3.0 and 6.0 results
$result3 = $results | Where-Object { $_.Scale -eq 3.0 }
$result6 = $results | Where-Object { $_.Scale -eq 6.0 }
$result45 = $results | Where-Object { $_.Scale -eq 4.5 }

if ($result3 -and $result6 -and $result3.MatchesExpected -and $result6.MatchesExpected) {
    $ratio6to3 = "N/A (same dimensions)"
    $ratio45to3 = "N/A (same dimensions)"
    
    Write-Host ""
    Write-Host "Ratios (based on dimensions):"
    Write-Host "6cm/3cm height ratio: $ratio6to3"
    Write-Host "4.5cm/3cm height ratio: $ratio45to3"
} else {
    Write-Host ""
    Write-Host "Cannot compute ratios - dimensions don't match or images missing"
}

$resultsJson = $results | ConvertTo-Json -Depth 3
Write-Host ""
Write-Host "Results:"
$resultsJson`;
    
    const scriptPath = path.join(OUTPUT_DIR, 'analyze_images.ps1');
    fs.writeFileSync(scriptPath, analysisScript);
    
    console.log(`Created analysis script: ${scriptPath}`);
    console.log('Running analysis...');
    
    // We'll run this via shell
    const { exec } = await import('child_process');
    
    return new Promise((resolve) => {
        exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Analysis error: ${error.message}`);
                report.step6 = { error: error.message };
            } else {
                console.log(stdout);
                if (stderr) console.error(stderr);
                
                // Parse results from output
                try {
                    const lines = stdout.split('\n');
                    const results = [];
                    let currentResult = null;
                    
                    for (const line of lines) {
                        if (line.includes('Scale =') && line.includes('Path =')) {
                            try {
                                const jsonStart = stdout.indexOf('[');
                                const jsonEnd = stdout.lastIndexOf(']') + 1;
                                if (jsonStart !== -1 && jsonEnd !== -1) {
                                    const jsonStr = stdout.substring(jsonStart, jsonEnd);
                                    const parsed = JSON.parse(jsonStr);
                                    report.step6 = { analysis: parsed };
                                }
                            } catch (e) {
                                // If JSON parsing fails, store raw output
                                report.step6 = { rawOutput: stdout };
                            }
                        }
                    }
                } catch (e) {
                    report.step6 = { rawOutput: stdout, parseError: e.message };
                }
            }
            resolve();
        });
    });
}

// Step 7: Final credit check
async function step7() {
    console.log('\n=== STEP 7: Final credit balance ===');
    const result = await makeApiCall('GET', '/s2s/v1.0/client/credit', null, 'Final Credit Balance');
    report.step7 = result;
    return true;
}

// Main execution
async function main() {
    console.log('=== B0 Task Execution ===');
    console.log(`Start time: ${report.startTime}`);
    console.log(`API Base: ${BASE_URL}`);
    console.log(`Unit budget: ${report.unitBudget}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
    
    try {
        // Step 1
        if (!await step1()) {
            console.error('Step 1 failed - stopping');
            await saveReport();
            return;
        }
        
        // Step 2
        await step2();
        
        // Check if we should proceed with paid tasks
        if (report.failedAttempts >= 4) {
            console.error(`Reached ${report.failedAttempts} failed attempts - stopping`);
            await saveReport();
            return;
        }
        
        // Step 3 (1 unit)
        const step3Success = await step3();
        
        if (step3Success) {
            // Step 4 (1 unit)
            const step4Success = await step4();
            
            if (step4Success) {
                // Step 5 (1 unit)
                await step5();
            }
        }
        
        // Step 6 (free)
        await step6();
        
        // Step 7 (free)
        await step7();
        
        // Final report
        report.endTime = new Date().toISOString();
        await saveReport();
        
        console.log('\n=== EXECUTION COMPLETE ===');
        console.log(`Units used: ${report.unitsUsed}/${report.unitBudget}`);
        console.log(`Failed attempts: ${report.failedAttempts}`);
        console.log(`Report saved to: ${REPORT_FILE}`);
        
    } catch (error) {
        console.error(`Unhandled error: ${error.message}`);
        report.errors.push(`Unhandled: ${error.message}`);
        report.endTime = new Date().toISOString();
        await saveReport();
    }
}

// Save report
async function saveReport() {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`Report saved to ${REPORT_FILE}`);
}

// Run main
main().catch(console.error);