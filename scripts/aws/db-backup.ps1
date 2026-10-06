# ==============================================================================
# Blynt Database Backup Script (PowerShell)
# Target: PostgreSQL (Render, Local, or AWS RDS)
# Generates custom-format pg_dump with blobs and SHA256 checksum.
# ==============================================================================

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$DatabaseUrl = $env:DATABASE_URL,

    [Parameter(Mandatory = $false)]
    [string]$BackupDir = "backups"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    Write-Error "DATABASE_URL environment variable or parameter is required. Format: postgresql://user:password@host:port/dbname"
    exit 1
}

if (-not (Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "blynt_backup_$Timestamp.dump"
$ChecksumFile = "$BackupFile.sha256"

Write-Host "[+] ===========================================================" -ForegroundColor Cyan
Write-Host "[+] Starting Blynt Database Backup" -ForegroundColor Cyan
Write-Host "[+] Timestamp   : $Timestamp"
Write-Host "[+] Destination : $BackupFile"
Write-Host "[+] ===========================================================" -ForegroundColor Cyan

try {
    # Run pg_dump
    & pg_dump --dbname="$DatabaseUrl" --format=c --blobs --verbose --file="$BackupFile"
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump returned exit code $LASTEXITCODE"
    }

    $FileHash = Get-FileHash -Path $BackupFile -Algorithm SHA256
    "$($FileHash.Hash)  $((Split-Path $BackupFile -Leaf))" | Out-File -FilePath $ChecksumFile -Encoding utf8

    $FileSize = (Get-Item $BackupFile).Length / 1MB
    Write-Host "[+] Backup completed successfully ($([math]::Round($FileSize, 2)) MB): $BackupFile" -ForegroundColor Green
    Write-Host "[+] SHA256 Checksum: $($FileHash.Hash)" -ForegroundColor Green
}
catch {
    Write-Error "[-] Backup failed: $_"
    exit 1
}
