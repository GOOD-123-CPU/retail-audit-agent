$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeIcon {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool DestroyIcon(IntPtr handle);
}
"@

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OutputDir = Join-Path $ProjectRoot "assets\launcher"
$PngPath = Join-Path $OutputDir "retail-audit-launcher.png"
$IcoPath = Join-Path $OutputDir "retail-audit-launcher.ico"

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2

  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-LauncherArtwork {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size
  )

  $Graphics.Clear([System.Drawing.Color]::Transparent)
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $canvas = [float]$Size
  $padding = $canvas * 0.07
  $cardSize = $canvas - ($padding * 2)
  $cardPath = New-RoundedRectPath -X $padding -Y $padding -Width $cardSize -Height $cardSize -Radius ($canvas * 0.16)

  $bgStart = New-Object System.Drawing.PointF($padding, $padding)
  $bgEnd = New-Object System.Drawing.PointF(($padding + $cardSize), ($padding + $cardSize))
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgStart,
    $bgEnd,
    ([System.Drawing.Color]::FromArgb(255, 6, 22, 40)),
    ([System.Drawing.Color]::FromArgb(255, 11, 72, 107))
  )
  $Graphics.FillPath($bgBrush, $cardPath)

  $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($cardPath)
  $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(120, 29, 188, 224)
  $glowBrush.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(10, 3, 14, 28))
  $Graphics.FillEllipse($glowBrush, $canvas * 0.16, $canvas * 0.08, $canvas * 0.68, $canvas * 0.56)

  $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(42, 155, 216, 255), [float]($canvas * 0.008))
  for ($i = 1; $i -le 3; $i++) {
    $y = $canvas * (0.24 + ($i * 0.12))
    $Graphics.DrawLine($gridPen, $canvas * 0.16, $y, $canvas * 0.84, $y)
  }

  $orbitPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 255, 187, 72), [float]($canvas * 0.022))
  $Graphics.DrawArc($orbitPen, $canvas * 0.17, $canvas * 0.16, $canvas * 0.66, $canvas * 0.66, 210, 245)

  $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(175, 106, 230, 255), [float]($canvas * 0.014))
  $Graphics.DrawEllipse($ringPen, $canvas * 0.19, $canvas * 0.19, $canvas * 0.62, $canvas * 0.62)

  $shieldPoints = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.50), [float]($canvas * 0.20))),
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.72), [float]($canvas * 0.30))),
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.69), [float]($canvas * 0.60))),
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.50), [float]($canvas * 0.80))),
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.31), [float]($canvas * 0.60))),
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.28), [float]($canvas * 0.30)))
  )
  $shieldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $shieldPath.AddPolygon($shieldPoints)

  $shieldStart = New-Object System.Drawing.PointF(($canvas * 0.28), ($canvas * 0.24))
  $shieldEnd = New-Object System.Drawing.PointF(($canvas * 0.72), ($canvas * 0.80))
  $shieldFill = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $shieldStart,
    $shieldEnd,
    ([System.Drawing.Color]::FromArgb(230, 7, 28, 49)),
    ([System.Drawing.Color]::FromArgb(230, 16, 102, 149))
  )
  $Graphics.FillPath($shieldFill, $shieldPath)

  $shieldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(245, 131, 234, 255), [float]($canvas * 0.018))
  $Graphics.DrawPath($shieldPen, $shieldPath)

  $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 197, 245, 255), [float]($canvas * 0.012))
  $nodeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 204, 92))
  $points = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.39), [float]($canvas * 0.55))),
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.48), [float]($canvas * 0.45))),
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.61), [float]($canvas * 0.41))),
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.61), [float]($canvas * 0.58))),
    (New-Object System.Drawing.PointF -ArgumentList @([float]($canvas * 0.47), [float]($canvas * 0.64)))
  )

  $Graphics.DrawLine($linePen, $points[0], $points[1])
  $Graphics.DrawLine($linePen, $points[1], $points[2])
  $Graphics.DrawLine($linePen, $points[1], $points[3])
  $Graphics.DrawLine($linePen, $points[0], $points[4])
  $Graphics.DrawLine($linePen, $points[3], $points[4])

  foreach ($point in $points) {
    $nodeSize = $canvas * 0.04
    $Graphics.FillEllipse($nodeBrush, $point.X - ($nodeSize / 2), $point.Y - ($nodeSize / 2), $nodeSize, $nodeSize)
  }

  $barBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(210, 119, 231, 255))
  $Graphics.FillRectangle($barBrush, $canvas * 0.37, $canvas * 0.33, $canvas * 0.045, $canvas * 0.18)
  $Graphics.FillRectangle($barBrush, $canvas * 0.45, $canvas * 0.28, $canvas * 0.045, $canvas * 0.23)
  $Graphics.FillRectangle($barBrush, $canvas * 0.53, $canvas * 0.36, $canvas * 0.045, $canvas * 0.15)

  $scanPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(235, 255, 213, 102), [float]($canvas * 0.028))
  $Graphics.DrawArc($scanPen, $canvas * 0.23, $canvas * 0.34, $canvas * 0.54, $canvas * 0.40, 22, 112)

  $cardPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(75, 255, 255, 255), [float]($canvas * 0.008))
  $Graphics.DrawPath($cardPen, $cardPath)

  $cardPen.Dispose()
  $scanPen.Dispose()
  $barBrush.Dispose()
  $nodeBrush.Dispose()
  $linePen.Dispose()
  $shieldPen.Dispose()
  $shieldFill.Dispose()
  $shieldPath.Dispose()
  $ringPen.Dispose()
  $orbitPen.Dispose()
  $gridPen.Dispose()
  $glowBrush.Dispose()
  $bgBrush.Dispose()
  $cardPath.Dispose()
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$pngBitmap = New-Object System.Drawing.Bitmap 512, 512
$pngGraphics = [System.Drawing.Graphics]::FromImage($pngBitmap)
Draw-LauncherArtwork -Graphics $pngGraphics -Size 512
$pngBitmap.Save($PngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$pngGraphics.Dispose()
$pngBitmap.Dispose()

$icoBitmap = New-Object System.Drawing.Bitmap 256, 256
$icoGraphics = [System.Drawing.Graphics]::FromImage($icoBitmap)
Draw-LauncherArtwork -Graphics $icoGraphics -Size 256
$iconHandle = $icoBitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)

$stream = [System.IO.File]::Open($IcoPath, [System.IO.FileMode]::Create)
try {
  $icon.Save($stream)
} finally {
  $stream.Dispose()
  $icon.Dispose()
  $icoGraphics.Dispose()
  $icoBitmap.Dispose()
  [NativeIcon]::DestroyIcon($iconHandle) | Out-Null
}

Write-Output "Created icon assets:"
Write-Output $PngPath
Write-Output $IcoPath
