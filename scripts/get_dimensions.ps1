param(
    [string]$ImagePath
)

Add-Type -AssemblyName System.Drawing

try {
    $image = [System.Drawing.Image]::FromFile($ImagePath)
    $width = $image.Width
    $height = $image.Height
    $size = (Get-Item $ImagePath).Length
    $image.Dispose()
    
    [PSCustomObject]@{
        Width = $width
        Height = $height
        Size = $size
        Path = $ImagePath
    } | ConvertTo-Json
} catch {
    [PSCustomObject]@{
        Error = $_.Exception.Message
        Path = $ImagePath
    } | ConvertTo-Json
}