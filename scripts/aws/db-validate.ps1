# ==============================================================================
# Blynt Database Validation Script (PowerShell)
# Runs TypeScript validator to verify table row counts & financial invariants.
# ==============================================================================

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$TargetDatabaseUrl = $env:TARGET_DATABASE_URL,

    [Parameter(Mandatory = $false)]
    [string]$SourceDatabaseUrl = $env:SOURCE_DATABASE_URL
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($TargetDatabaseUrl)) {
    if (-not [string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
        $TargetDatabaseUrl = $env:DATABASE_URL
    } else {
        Write-Error "TARGET_DATABASE_URL or DATABASE_URL must be specified."
        exit 1
    }
}

$env:TARGET_DATABASE_URL = $TargetDatabaseUrl
if (-not [string]::IsNullOrWhiteSpace($SourceDatabaseUrl)) {
    $env:SOURCE_DATABASE_URL = $SourceDatabaseUrl
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "[+] Executing database validation checks..." -ForegroundColor Cyan
Set-Location -Path $RootDir
& npx tsx "$ScriptDir/db-validate.ts"

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
