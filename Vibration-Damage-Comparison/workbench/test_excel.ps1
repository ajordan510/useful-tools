$ErrorActionPreference = 'Stop'
$excelCheck = New-Object -ComObject Excel.Application
$bookCheck = $null
try {
    $pathCheck = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../vibration_spectra_template.xlsx')).Path
    $bookCheck = $excelCheck.Workbooks.Open($pathCheck, 0, $true)
    if ($bookCheck.Worksheets.Count -ne 7) { throw 'Expected seven template worksheets.' }
    foreach ($itemCheck in @(@('Profiles','B2'), @('Sine','D2'), @('Cases','G2'), @('Settings','B2'))) {
        $cellCheck = $bookCheck.Worksheets.Item($itemCheck[0]).Range($itemCheck[1])
        if ($cellCheck.Validation.Type -ne 3) { throw "Missing list validation: $($itemCheck[0])" }
        Write-Output "$($itemCheck[0]) $($itemCheck[1]): $($cellCheck.Validation.Formula1)"
    }
    if ($bookCheck.Worksheets.Item('Sine').Range('E2').Value2 -ne 10) { throw 'Sine input changed on open.' }
    if ($bookCheck.Worksheets.Item('Random').Range('C2').Value2 -ne 0.01) { throw 'PSD input changed on open.' }
    Write-Output 'PASS desktop Excel: template opens read-only, seven worksheets, numeric inputs and dropdown validation retained.'
} finally {
    if ($null -ne $bookCheck) { $bookCheck.Close($false) }
    if ($excelCheck.Workbooks.Count -eq 0) { $excelCheck.Quit() }
}
