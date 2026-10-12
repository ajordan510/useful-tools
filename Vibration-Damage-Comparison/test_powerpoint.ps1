# Optional Windows/PowerPoint layout check; run test_collection.mjs first.
param([string]$ArtifactDirectory = (Join-Path $PSScriptRoot '_paper_build/collection'))
$ErrorActionPreference = 'Stop'
$powerPointCheck = New-Object -ComObject PowerPoint.Application
$failures = @()
try {
    foreach ($name in @('seven-cases', 'appendix', 'long-labels')) {
        $deckPath = (Resolve-Path -LiteralPath (Join-Path $ArtifactDirectory "$name.pptx")).Path
        $renderPath = Join-Path (Split-Path $deckPath) "rendered-$name"
        New-Item -ItemType Directory -Force -Path $renderPath | Out-Null
        $presentationCheck = $null
        try {
            # ReadOnly, Untitled, WithWindow: never edit the generated source deck.
            $presentationCheck = $powerPointCheck.Presentations.Open($deckPath, $true, $false, $false)
            $presentationCheck.Export($renderPath, 'PNG', 1600, 900)
            $widthCheck = $presentationCheck.PageSetup.SlideWidth
            $heightCheck = $presentationCheck.PageSetup.SlideHeight
            foreach ($slideCheck in $presentationCheck.Slides) {
                foreach ($shapeCheck in $slideCheck.Shapes) {
                    if ($shapeCheck.Top -lt -1 -or $shapeCheck.Left -lt -1 -or
                        ($shapeCheck.Top + $shapeCheck.Height) -gt ($heightCheck + 1) -or
                        ($shapeCheck.Left + $shapeCheck.Width) -gt ($widthCheck + 1)) {
                        $failures += "$name slide $($slideCheck.SlideIndex): $($shapeCheck.Name) exceeds slide bounds."
                    }
                }
            }
            Write-Output "Rendered $name : $($presentationCheck.Slides.Count) slides."
        } finally {
            if ($null -ne $presentationCheck) { $presentationCheck.Close() }
        }
    }
} finally {
    # PowerPoint may share its application with the user's other open decks.
    if ($powerPointCheck.Presentations.Count -eq 0) { $powerPointCheck.Quit() }
}
if ($failures.Count) { throw ($failures -join "`n") }
Write-Output 'PASS PowerPoint desktop: all three decks open and render; all shapes remain within slide bounds. Inspect the rendered PNGs for text/plot layout.'
