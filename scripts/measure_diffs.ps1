param(
    [string]$InputFacePath,
    [string]$OutputDir
)

Write-Host "=== Image Difference Measurement ==="
Write-Host "Input face: $InputFacePath"
Write-Host "Output directory: $OutputDir"

# Check if images exist
if (-not (Test-Path $InputFacePath)) {
    Write-Host "Error: Input face image not found at $InputFacePath"
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    Write-Host "Error: Output directory not found at $OutputDir"
    exit 1
}

# Load System.Drawing for basic image info
Add-Type -AssemblyName System.Drawing

# Get input image dimensions
try {
    $inputImage = [System.Drawing.Image]::FromFile($InputFacePath)
    $inputWidth = $inputImage.Width
    $inputHeight = $inputImage.Height
    $inputImage.Dispose()
    
    Write-Host "`nInput image dimensions: ${inputWidth}x${inputHeight}"
} catch {
    Write-Host "Error loading input image: $_"
    exit 1
}

# Find output images
$outputImages = Get-ChildItem -Path $OutputDir -Filter "*.jpg" -File | 
                Where-Object { $_.Name -notlike "*input*" -and $_.Name -notmatch "face|earring" }

if ($outputImages.Count -eq 0) {
    Write-Host "`nNo output images found in $OutputDir"
    Write-Host "Looking for: earring_3cm.jpg, earring_6cm.jpg, earring_4_5cm.jpg"
    
    # Check for specific expected files
    $expectedFiles = @("earring_3cm.jpg", "earring_6cm.jpg", "earring_4_5cm.jpg")
    foreach ($file in $expectedFiles) {
        $fullPath = Join-Path $OutputDir $file
        if (Test-Path $fullPath) {
            $outputImages += Get-Item $fullPath
        }
    }
}

if ($outputImages.Count -eq 0) {
    Write-Host "`nNo output images to measure. Skipping diff computation."
    exit 0
}

Write-Host "`nFound $($outputImages.Count) output image(s):"
foreach ($img in $outputImages) {
    Write-Host "  - $($img.Name)"
}

Write-Host "`n=== Measurement Results ==="
$results = @{}

foreach ($outputImg in $outputImages) {
    $outputPath = $outputImg.FullName
    $label = [System.IO.Path]::GetFileNameWithoutExtension($outputImg.Name)
    
    Write-Host "`n--- $label ---"
    
    try {
        $outputImage = [System.Drawing.Image]::FromFile($outputPath)
        $outputWidth = $outputImage.Width
        $outputHeight = $outputImage.Height
        $outputImage.Dispose()
        
        Write-Host "Output dimensions: ${outputWidth}x${outputHeight}"
        
        if ($inputWidth -ne $outputWidth -or $inputHeight -ne $outputHeight) {
            Write-Host "WARNING: Dimensions don't match! Input: ${inputWidth}x${inputHeight}, Output: ${outputWidth}x${outputHeight}"
            Write-Host "Cannot compute pixel diff (would need resizing)"
            
            $results[$label] = @{
                inputSize = "${inputWidth}x${inputHeight}"
                outputSize = "${outputWidth}x${outputHeight}"
                match = $false
                error = "dimension_mismatch"
            }
        } else {
            Write-Host "Dimensions match ✓"
            Write-Host "Note: Full pixel diff computation requires image processing library."
            Write-Host "For bounding box calculation, install canvas npm package and use measure_diffs.mjs"
            
            $results[$label] = @{
                inputSize = "${inputWidth}x${inputHeight}"
                outputSize = "${outputWidth}x${outputHeight}"
                match = $true
                note = "Use measure_diffs.mjs with canvas for pixel diff"
            }
        }
        
    } catch {
        Write-Host "Error processing $($outputImg.Name): $_"
        $results[$label] = @{
            error = $_.Exception.Message
        }
    }
}

# Save results
$resultsPath = Join-Path $OutputDir "diff_measurements_ps.json"
$results | ConvertTo-Json -Depth 3 | Out-File -FilePath $resultsPath -Encoding UTF8
Write-Host "`nResults saved to: $resultsPath"

Write-Host "`n=== Measurement complete ==="