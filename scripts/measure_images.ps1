$face = "E:\Chaos\Hackathons\Youcam\outputs\b0\inputs\face.jpg"
$earring = "E:\Chaos\Hackathons\Youcam\outputs\b0\inputs\earring.jpg"

Add-Type -AssemblyName System.Drawing

Write-Host "=== Image Measurements ==="

# Measure face
try {
    $img1 = [System.Drawing.Image]::FromFile($face)
    $size1 = (Get-Item $face).Length
    Write-Host "`nFace image:"
    Write-Host "  Dimensions: $($img1.Width) x $($img1.Height) px"
    Write-Host "  Size: $([math]::Round($size1/1KB, 2)) KB"
    $img1.Dispose()
} catch {
    Write-Host "Error measuring face: $_"
}

# Measure earring
try {
    $img2 = [System.Drawing.Image]::FromFile($earring)
    $size2 = (Get-Item $earring).Length
    $longSide = [math]::Max($img2.Width, $img2.Height)
    $sizeMB = $size2 / 1MB
    
    Write-Host "`nEarring image:"
    Write-Host "  Dimensions: $($img2.Width) x $($img2.Height) px"
    Write-Host "  Size: $([math]::Round($sizeMB, 2)) MB"
    Write-Host "  Long side: $longSide px"
    
    Write-Host "`nAPI requirements check:"
    Write-Host "  Long side <= 4096: $($longSide -le 4096)"
    Write-Host "  Size < 10 MB: $($sizeMB -lt 10)"
    
    if ($longSide -gt 4096 -or $sizeMB -ge 10) {
        Write-Host "`nWARNING: Earring image needs resizing for API!"
        Write-Host "Would need to create resized copy (long side 1500px) and upload via File API."
    } else {
        Write-Host "`nEarring image meets API requirements."
    }
    
    $img2.Dispose()
} catch {
    Write-Host "Error measuring earring: $_"
}

Write-Host "`n=== Measurement complete ==="