# Regenerate electron/assets/tray.png (64x64) from src/logo.png
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$src = Join-Path $root 'src\logo.png'
$destDir = Join-Path $root 'electron\assets'
$dest = Join-Path $destDir 'tray.png'
$outMain = Join-Path $root 'out\main\tray.png'

if (-not (Test-Path $src)) { throw "Missing logo: $src" }
New-Item -ItemType Directory -Force -Path $destDir, (Split-Path $outMain) | Out-Null

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($src)
$bmp = New-Object System.Drawing.Bitmap 64, 64
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($img, 0, 0, 64, 64)
$bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
if (Test-Path (Split-Path $outMain)) {
  $bmp.Save($outMain, [System.Drawing.Imaging.ImageFormat]::Png)
}
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
Write-Host "Wrote $dest (64x64)"
if (Test-Path (Split-Path $outMain)) { Write-Host "Wrote $outMain (64x64)" }
