# ==============================================================================
# Blynt Database Restore Script (PowerShell)
# Target: PostgreSQL (AWS RDS or Dev/Staging DB)
# Restores custom-format pg_dump with validation checks.
# ==============================================================================

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$BackupFile,

    [Parameter(Mandatory = $false)]
    [string]$TargetDatabaseUrl = $env:TARGET_DATABASE_URL,

    [Parameter(Mandatory = $false)]
    [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $BackupFile)) {
    Write-Error "Backup file not found: $BackupFile"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($TargetDatabaseUrl)) {
    Write-Error "TARGET_DATABASE_URL environment variable or parameter is required."
    exit 1
}

if (-not $Force -and ($env:CONFIRM_RESTORE -ne "true")) {
    Write-Warning "SAFETY CHECK: Restoring will overwrite existing data in the target database."
    Write-Warning "To proceed, pass -Force or set `$env:CONFIRM_RESTORE = 'true'."
    exit 1
}

$ChecksumFile = "$BackupFile.sha256"
if (Test-Path -Path $ChecksumFile) {
    Write-Host "[+] Verifying SHA256 checksum..." -ForegroundColor Cyan
    $ExpectedHash = (Get-Content $ChecksumFile | Select-Object -First 1).Split(" ")[0].Trim()
    $ActualHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
    if ($ExpectedHash.ToUpper() -ne $ActualHash.ToUpper()) {
        Write-Error "Checksum mismatch! Expected: $ExpectedHash, Actual: $ActualHash"
        exit 1
    }
    Write-Host "[+] Checksum valid ($ActualHash)." -ForegroundColor Green
}

Write-Host "[+] ===========================================================" -ForegroundColor Cyan
Write-Host "[+] Starting Blynt Database Restore" -ForegroundColor Cyan
Write-Host "[+] Source file: $BackupFile"
Write-Host "[+] ===========================================================" -ForegroundColor Cyan

try {
    & pg_restore `
        --dbname="$TargetDatabaseUrl" `
        --clean `
        --if-exists `
        --no-owner `
        --no-privileges `
        --verbose `
        "$BackupFile"

    Write-Host "[+] Restore command finished. Proceed with db-validate to verify integrity." -ForegroundColor Green
}
catch {
    Write-Error "[-] Restore execution failed: $_"
    exit 1
}
