param([string]$Deck = (Join-Path $PSScriptRoot '../_paper_build/workbench/seven-case-workbench.pptx'))
$ErrorActionPreference = 'Stop'
$appCheck = New-Object -ComObject PowerPoint.Application
$deckCheck = $null
try {
    $pathCheck = (Resolve-Path -LiteralPath $Deck).Path
    $renderCheck = Join-Path (Split-Path $pathCheck) 'rendered-workbench'
    New-Item -ItemType Directory -Force -Path $renderCheck | Out-Null
    $deckCheck = $appCheck.Presentations.Open($pathCheck, $true, $false, $false)
    $deckCheck.Export($renderCheck, 'PNG', 1600, 900)
    foreach ($slideCheck in $deckCheck.Slides) {
        foreach ($shapeCheck in $slideCheck.Shapes) {
            if ($shapeCheck.Top -lt -1 -or $shapeCheck.Left -lt -1 -or
                ($shapeCheck.Top + $shapeCheck.Height) -gt ($deckCheck.PageSetup.SlideHeight + 1) -or
                ($shapeCheck.Left + $shapeCheck.Width) -gt ($deckCheck.PageSetup.SlideWidth + 1)) {
                throw "Slide $($slideCheck.SlideIndex) contains an out-of-bounds shape."
            }
        }
    }
    Write-Output "Opened and rendered $($deckCheck.Slides.Count) slides; all shapes within slide bounds."
} finally {
    if ($null -ne $deckCheck) { $deckCheck.Close() }
    if ($appCheck.Presentations.Count -eq 0) { $appCheck.Quit() }
}
