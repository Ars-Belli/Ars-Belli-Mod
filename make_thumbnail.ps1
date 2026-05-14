# Generates .metadata/thumbnail.png for the Ars Belli Mod using GDI+.
# Re-runnable: regenerate the thumbnail any time by running this script.
Add-Type -AssemblyName System.Drawing

$size = 512
$bmp  = New-Object System.Drawing.Bitmap($size, $size)
$g    = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# --- Background: vertical gradient, dark maroon -> near black ---
$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 61, 20, 20),
    [System.Drawing.Color]::FromArgb(255, 18, 10, 10),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
$g.FillRectangle($bgBrush, $rect)

# Subtle radial highlight behind the swords
$gp = New-Object System.Drawing.Drawing2D.GraphicsPath
$gp.AddEllipse(96, 70, 320, 320)
$radial = New-Object System.Drawing.Drawing2D.PathGradientBrush($gp)
$radial.CenterColor    = [System.Drawing.Color]::FromArgb(70, 150, 60, 50)
$radial.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$g.FillEllipse($radial, 96, 70, 320, 320)

# --- Sword drawing helper (sword points up, origin at crossguard center) ---
function Draw-Sword {
    param($g, $cx, $cy, $angleDeg)
    $state = $g.Save()
    $g.TranslateTransform([single]$cx, [single]$cy)
    $g.RotateTransform([single]$angleDeg)

    $bladeLen = 168
    $bw       = 9
    $steel    = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Rectangle(-$bw, -$bladeLen, ($bw*2), $bladeLen)),
        [System.Drawing.Color]::FromArgb(255, 230, 232, 238),
        [System.Drawing.Color]::FromArgb(255, 120, 124, 132),
        [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal)

    # Blade (pointed polygon)
    $blade = @(
        (New-Object System.Drawing.PointF([single](-$bw), [single]0)),
        (New-Object System.Drawing.PointF([single]$bw,    [single]0)),
        (New-Object System.Drawing.PointF([single]$bw,    [single](-$bladeLen + 26))),
        (New-Object System.Drawing.PointF([single]0,      [single](-$bladeLen))),
        (New-Object System.Drawing.PointF([single](-$bw), [single](-$bladeLen + 26)))
    )
    $g.FillPolygon($steel, $blade)
    # Center fuller line
    $fullerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 60, 62, 66), [single]2)
    $g.DrawLine($fullerPen, [single]0, [single](-6), [single]0, [single](-$bladeLen + 30))

    $gold = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Rectangle(-40, -12, 80, 30)),
        [System.Drawing.Color]::FromArgb(255, 245, 214, 110),
        [System.Drawing.Color]::FromArgb(255, 150, 110, 30),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)

    # Crossguard
    $g.FillRectangle($gold, -38, -7, 76, 14)
    # Grip
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 70, 44, 24))), -6, 7, 12, 46)
    # Pommel
    $g.FillEllipse($gold, -11, 50, 22, 22)

    $g.Restore($state)
}

# Two crossed swords, hilts at bottom, occupying the upper portion
Draw-Sword -g $g -cx 198 -cy 286 -angleDeg 30
Draw-Sword -g $g -cx 314 -cy 286 -angleDeg -30

# --- Dark band behind the title for legibility ---
$band = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(165, 8, 5, 5))
$g.FillRectangle($band, 0, 322, $size, 150)

# --- Title text ---
$titleFont = New-Object System.Drawing.Font("Garamond", 58, [System.Drawing.FontStyle]::Bold)
if ($titleFont.Name -ne "Garamond") {
    $titleFont = New-Object System.Drawing.Font("Times New Roman", 54, [System.Drawing.FontStyle]::Bold)
}
$subFont = New-Object System.Drawing.Font("Times New Roman", 19, [System.Drawing.FontStyle]::Regular)

$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment     = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

$goldText  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 226, 196, 110))
$shadow    = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 0, 0, 0))
$subText   = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 198, 196, 192))

$titleRect  = New-Object System.Drawing.RectangleF(0, 338, $size, 80)
$titleRectS = New-Object System.Drawing.RectangleF(3, 341, $size, 80)
$g.DrawString("ARS BELLI", $titleFont, $shadow, $titleRectS, $fmt)
$g.DrawString("ARS BELLI", $titleFont, $goldText, $titleRect, $fmt)

$subRect = New-Object System.Drawing.RectangleF(0, 416, $size, 34)
$g.DrawString("MULTIPLAYER WARFARE MOD", $subFont, $subText, $subRect, $fmt)

# --- Decorative gold frame ---
$framePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 170, 132, 52), [single]4)
$g.DrawRectangle($framePen, 8, 8, $size - 17, $size - 17)
$innerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 226, 196, 110), [single]1)
$g.DrawRectangle($innerPen, 16, 16, $size - 33, $size - 33)

# --- Save ---
$outDir = Join-Path $PSScriptRoot ".metadata"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$outPath = Join-Path $outDir "thumbnail.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
Write-Host "Thumbnail written to $outPath"
