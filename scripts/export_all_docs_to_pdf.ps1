$ErrorActionPreference = "Stop"

$docs = @(
    @{ Docx = "D:\Project\F!\docs\blynt_Complete_Documentation.docx"; Pdf = "D:\Project\F!\docs\blynt_Complete_Documentation.pdf" },
    @{ Docx = "D:\Project\F!\docs\blynt_Code_Explainer.docx";          Pdf = "D:\Project\F!\docs\blynt_Code_Explainer.pdf" },
    @{ Docx = "D:\Project\F!\docs\blynt_Playbook.docx";                Pdf = "D:\Project\F!\docs\blynt_Playbook.pdf" }
)

$word = New-Object -ComObject Word.Application
$word.Visible = $false

try {
    foreach ($item in $docs) {
        Write-Host "Converting $($item.Docx) to $($item.Pdf)..." -ForegroundColor Cyan
        $resolvedDocx = (Resolve-Path $item.Docx).Path
        $resolvedPdf  = [System.IO.Path]::GetFullPath($item.Pdf)
        
        $doc = $word.Documents.Open($resolvedDocx)
        $doc.SaveAs([ref]$resolvedPdf, [ref]17) # 17 = wdFormatPDF
        $doc.Close()
        Write-Host "Successfully generated: $resolvedPdf" -ForegroundColor Green
    }
}
finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
