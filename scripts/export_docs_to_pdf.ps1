# Automated script to regenerate the Word DOCX and PDF documentation
param(
    [string]$DocxPath = "$PSScriptRoot\..\docs\blynt_Complete_Documentation.docx",
    [string]$PdfPath = "$PSScriptRoot\..\docs\blynt_Complete_Documentation.pdf"
)

$ErrorActionPreference = "Stop"

Write-Host "1. Generating DOCX via python..." -ForegroundColor Cyan
python "$PSScriptRoot\generate_docx.py"

Write-Host "2. Converting DOCX to PDF using Word COM..." -ForegroundColor Cyan
$resolvedDocx = (Resolve-Path $DocxPath).Path
$resolvedPdf = [System.IO.Path]::GetFullPath($PdfPath)

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($resolvedDocx)
    # wdFormatPDF = 17
    $doc.SaveAs([ref]$resolvedPdf, [ref]17)
    $doc.Close()
    Write-Host "Success: PDF generated at $resolvedPdf" -ForegroundColor Green
}
finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
