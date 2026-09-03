Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\ChatGPT Image Sep 3, 2026, 11_35_27 PM.png"
$assetsDir = Join-Path $PSScriptRoot "..\assets"

if (-not (Test-Path $srcPath)) {
    Write-Error "Source image not found at $srcPath"
    exit 1
}

$srcImg = [System.Drawing.Bitmap]::FromFile($srcPath)
$origW = $srcImg.Width
$origH = $srcImg.Height

# We want the squircle with its subtle neon glow, with transparent outside corners
# Crop rectangle tightly centered around squircle + subtle glow
$cropX = 50
$cropY = 50
$cropW = $origW - 100
$cropH = $origH - 100

function Create-RoundedRectanglePath {
    param(
        [float]$x,
        [float]$y,
        [float]$width,
        [float]$height,
        [float]$radius
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $arc = New-Object System.Drawing.RectangleF $x, $y, $diameter, $diameter

    $path.AddArc($arc, 180, 90)
    $arc.X = $x + $width - $diameter
    $path.AddArc($arc, 270, 90)
    $arc.Y = $y + $height - $diameter
    $path.AddArc($arc, 0, 90)
    $arc.X = $x
    $path.AddArc($arc, 90, 90)
    $path.CloseFigure()
    return $path
}

function Generate-IconBitmap {
    param([int]$targetSize)

    $destBmp = New-Object System.Drawing.Bitmap $targetSize, $targetSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Squircle clipping region with soft rounded corners matching the ChatGPT artwork
    $pad = [math]::Max(0.0, [float]$targetSize * 0.02)
    $w = [float]$targetSize - ($pad * 2)
    $h = [float]$targetSize - ($pad * 2)
    $radius = $w * 0.225

    $clipPath = Create-RoundedRectanglePath $pad $pad $w $h $radius
    $g.SetClip($clipPath)

    # Draw source image scaled to fill
    $srcRect = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropW, $cropH
    $destRect = New-Object System.Drawing.RectangleF $pad, $pad, $w, $h
    $g.DrawImage($srcImg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $g.ResetClip()
    $clipPath.Dispose()
    $g.Dispose()

    return $destBmp
}

# Generate 512x512 and 256x256 PNGs
$bmp512 = Generate-IconBitmap 512
$bmp512.Save((Join-Path $assetsDir "icon-512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp512.Dispose()

$bmp256 = Generate-IconBitmap 256
$bmp256.Save((Join-Path $assetsDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Saved $(Join-Path $assetsDir 'icon.png')"

# Also save into renderer assets
$rendererAssets = Join-Path $PSScriptRoot "..\src\renderer\assets"
$bmp256.Save((Join-Path $rendererAssets "app-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp256.Dispose()

# Create multi-resolution Windows ICO
$sizes = @(256, 128, 64, 48, 32, 16)
$pngStreams = @()

foreach ($s in $sizes) {
    $bmp = Generate-IconBitmap $s
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngStreams += @{ Size = $s; Stream = $ms; Bytes = $ms.ToArray() }
    $bmp.Dispose()
}

$icoPath = Join-Path $assetsDir "icon.ico"
$icoStream = New-Object System.IO.FileStream $icoPath, ([System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter $icoStream

$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$pngStreams.Count)

$offset = 6 + ($pngStreams.Count * 16)

foreach ($item in $pngStreams) {
    $w = if ($item.Size -ge 256) { [byte]0 } else { [byte]$item.Size }
    $h = if ($item.Size -ge 256) { [byte]0 } else { [byte]$item.Size }
    $bytes = $item.Bytes
    
    $writer.Write($w)
    $writer.Write($h)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$bytes.Length)
    $writer.Write([uint32]$offset)
    
    $offset += $bytes.Length
}

foreach ($item in $pngStreams) {
    $writer.Write($item.Bytes)
    $item.Stream.Dispose()
}

$writer.Flush()
$writer.Close()
$icoStream.Dispose()

$srcImg.Dispose()

Write-Output "Successfully generated $icoPath from user ChatGPT artwork!"
