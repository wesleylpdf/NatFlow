Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path 'public/icons' | Out-Null

function Generate-Icon($size, $path, $isMaskable) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $c1 = [System.Drawing.ColorTranslator]::FromHtml('#047857')
    $c2 = [System.Drawing.ColorTranslator]::FromHtml('#0d9488')
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 45.0
    
    if ($isMaskable) {
        $g.FillRectangle($brush, $rect)
    } else {
        $radius = [int]($size * 0.22)
        $pathObj = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $radius * 2
        $pathObj.AddArc(0, 0, $d, $d, 180, 90)
        $pathObj.AddArc($size - $d, 0, $d, $d, 270, 90)
        $pathObj.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
        $pathObj.AddArc(0, $size - $d, $d, $d, 90, 90)
        $pathObj.CloseFigure()
        $g.FillPath($brush, $pathObj)
    }
    
    $cx = [float]($size / 2)
    $cy = [float]($size / 2)
    $scale = [float]($size / 240.0)
    
    # White dot
    $dotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $r = [float](10 * $scale)
    $g.FillEllipse($dotBrush, $cx - $r, $cy - $r - (5 * $scale), $r * 2, $r * 2)
    
    # Left Petal
    $pLeft = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pLeft.AddBezier($cx, 45 * $scale, 75 * $scale, 75 * $scale, 60 * $scale, 120 * $scale, 75 * $scale, 160 * $scale)
    $pLeft.AddBezier(75 * $scale, 160 * $scale, 85 * $scale, 186 * $scale, 110 * $scale, 195 * $scale, $cx, 195 * $scale)
    $pLeft.AddBezier($cx, 195 * $scale, 120 * $scale, 160 * $scale, 135 * $scale, 120 * $scale, $cx, 45 * $scale)
    $pLeft.CloseFigure()
    $leafBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
    $g.FillPath($leafBrush, $pLeft)
    
    # Right Petal
    $pRight = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pRight.AddBezier($cx, 45 * $scale, 165 * $scale, 75 * $scale, 180 * $scale, 120 * $scale, 165 * $scale, 160 * $scale)
    $pRight.AddBezier(165 * $scale, 160 * $scale, 155 * $scale, 186 * $scale, 130 * $scale, 195 * $scale, $cx, 195 * $scale)
    $pRight.AddBezier($cx, 195 * $scale, 120 * $scale, 160 * $scale, 105 * $scale, 120 * $scale, $cx, 45 * $scale)
    $pRight.CloseFigure()
    $leafBrush2 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 255, 255, 255))
    $g.FillPath($leafBrush2, $pRight)
    
    # Gold Center
    $goldBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#f59e0b'))
    $pGold = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pGold.AddBezier($cx, 75 * $scale, 102 * $scale, 110 * $scale, 102 * $scale, 145 * $scale, $cx, 178 * $scale)
    $pGold.AddBezier($cx, 178 * $scale, 138 * $scale, 145 * $scale, 138 * $scale, 110 * $scale, $cx, 75 * $scale)
    $pGold.CloseFigure()
    $g.FillPath($goldBrush, $pGold)
    
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

Generate-Icon 192 'public/icons/icon-192.png' $false
Generate-Icon 512 'public/icons/icon-512.png' $false
Generate-Icon 512 'public/icons/icon-maskable-512.png' $true
Write-Output "Icons generated successfully!"
