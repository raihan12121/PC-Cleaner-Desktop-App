Add-Type -AssemblyName System.Drawing

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

    # Top-left arc
    $path.AddArc($arc, 180, 90)

    # Top-right arc
    $arc.X = $x + $width - $diameter
    $path.AddArc($arc, 270, 90)

    # Bottom-right arc
    $arc.Y = $y + $height - $diameter
    $path.AddArc($arc, 0, 90)

    # Bottom-left arc
    $arc.X = $x
    $path.AddArc($arc, 90, 90)

    $path.CloseFigure()
    return $path
}

function Render-LogoBitmap {
    param([int]$size)

    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $pad = [math]::Max(1.0, [float]$size * 0.05)
    $w = [float]$size - ($pad * 2)
    $h = [float]$size - ($pad * 2)
    $radius = $w * 0.22

    # Squircle Path
    $squircle = Create-RoundedRectanglePath $pad $pad $w $h $radius

    # Linear Gradient (Apple Blue #0A84FF to Royal Purple #AF52DE)
    $p1 = New-Object System.Drawing.PointF $pad, ($pad + $h)
    $p2 = New-Object System.Drawing.PointF ($pad + $w), $pad
    $c1 = [System.Drawing.Color]::FromArgb(255, 10, 132, 255)
    $c2 = [System.Drawing.Color]::FromArgb(255, 175, 82, 222)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $p1, $p2, $c1, $c2

    $g.FillPath($brush, $squircle)

    # Subtle inner highlight border
    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 255, 255, 255)), ([math]::Max(1.0, [float]$size * 0.015))
    $g.DrawPath($borderPen, $squircle)

    # Lightning Bolt Path from App.tsx:
    # M13 10 V3 L4 14 h7 v7 l9 -11 h-7 z (viewBox: 24x24)
    # Scaled and centered
    $scale = ($w * 0.62) / 24.0
    $offX = ($size - (24.0 * $scale)) / 2.0
    $offY = ($size - (24.0 * $scale)) / 2.0

    $pts = @(
        (New-Object System.Drawing.PointF ($offX + 13.0 * $scale), ($offY + 10.0 * $scale)),
        (New-Object System.Drawing.PointF ($offX + 13.0 * $scale), ($offY + 3.0 * $scale)),
        (New-Object System.Drawing.PointF ($offX + 4.0 * $scale),  ($offY + 14.0 * $scale)),
        (New-Object System.Drawing.PointF ($offX + 11.0 * $scale), ($offY + 14.0 * $scale)),
        (New-Object System.Drawing.PointF ($offX + 11.0 * $scale), ($offY + 21.0 * $scale)),
        (New-Object System.Drawing.PointF ($offX + 20.0 * $scale), ($offY + 10.0 * $scale))
    )

    $strokeWidth = [math]::Max(1.5, [float]$size * 0.065)

    # Outer soft glow
    $glowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(45, 255, 255, 255)), ($strokeWidth * 2.2)
    $glowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPolygon($glowPen, $pts)

    # Main White Outline
    $whitePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $strokeWidth
    $whitePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPolygon($whitePen, $pts)

    # Clean up
    $whitePen.Dispose()
    $glowPen.Dispose()
    $borderPen.Dispose()
    $brush.Dispose()
    $squircle.Dispose()
    $g.Dispose()

    return $bmp
}

# Create assets folder if needed
$assetsDir = Join-Path $PSScriptRoot "..\assets"
if (-not (Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir | Out-Null
}

$sizes = @(256, 128, 64, 48, 32, 16)
$pngStreams = @()

foreach ($s in $sizes) {
    $bmp = Render-LogoBitmap $s
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngStreams += @{ Size = $s; Stream = $ms; Bytes = $ms.ToArray() }
    
    if ($s -eq 256) {
        $pngPath = Join-Path $assetsDir "icon.png"
        [System.IO.File]::WriteAllBytes($pngPath, $ms.ToArray())
        Write-Output "Saved: $pngPath"
    }
    $bmp.Dispose()
}

# Also render 512x512 for high DPI
$bmp512 = Render-LogoBitmap 512
$bmp512.Save((Join-Path $assetsDir "icon-512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp512.Dispose()

# Build Multi-Frame Windows ICO with PNG compressed frames
$icoPath = Join-Path $assetsDir "icon.ico"
$icoStream = New-Object System.IO.FileStream $icoPath, ([System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter $icoStream

# ICONDIR header: idReserved (0), idType (1 for icon), idCount
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$pngStreams.Count)

$offset = 6 + ($pngStreams.Count * 16)

# Write ICONDIRENTRY for each size
foreach ($item in $pngStreams) {
    $w = if ($item.Size -ge 256) { [byte]0 } else { [byte]$item.Size }
    $h = if ($item.Size -ge 256) { [byte]0 } else { [byte]$item.Size }
    $bytes = $item.Bytes
    
    $writer.Write($w)                    # bWidth
    $writer.Write($h)                    # bHeight
    $writer.Write([byte]0)               # bColorCount
    $writer.Write([byte]0)               # bReserved
    $writer.Write([uint16]1)             # wPlanes
    $writer.Write([uint16]32)            # wBitCount
    $writer.Write([uint32]$bytes.Length) # dwBytesInRes
    $writer.Write([uint32]$offset)       # dwImageOffset
    
    $offset += $bytes.Length
}

# Write PNG data streams
foreach ($item in $pngStreams) {
    $writer.Write($item.Bytes)
    $item.Stream.Dispose()
}

$writer.Flush()
$writer.Close()
$icoStream.Dispose()

Write-Output "Saved: $icoPath (Multi-frame Windows Icon)"
