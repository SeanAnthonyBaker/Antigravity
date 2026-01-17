# backup_supabase.ps1
# Automated Supabase Production Database Backup Script
# Backs up the production database to supabase\.temp with timestamped filenames
# NOTE: This script requires you to be logged into Supabase CLI (npx supabase login)
# and may prompt for your database password

$ErrorActionPreference = "Stop"

# Configuration
$BACKUP_DIR = "c:\Users\seanb\OneDrive\Documents\Tulkah.ai\Antigravity\supabase\.temp"
$SUPABASE_DIR = "c:\Users\seanb\OneDrive\Documents\Tulkah.ai\Antigravity\supabase"

# Get current timestamp for filename (ISO format, safe for filenames)
$timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"

# Ensure backup directory exists
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
    Write-Host "Created backup directory: $BACKUP_DIR" -ForegroundColor Yellow
}

Write-Host "=== Supabase Production Database Backup ===" -ForegroundColor Cyan
Write-Host "Timestamp: $timestamp" -ForegroundColor Gray
Write-Host "Backup Directory: $BACKUP_DIR" -ForegroundColor Gray
Write-Host ""

# Change to supabase directory
Push-Location $SUPABASE_DIR

try {
    # Backup schema
    $schemaFile = Join-Path $BACKUP_DIR "backup_${timestamp}_schema.sql"
    Write-Host "Backing up schema to: $schemaFile" -ForegroundColor Yellow
    npx supabase db dump --linked -s public -f $schemaFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Schema backup complete" -ForegroundColor Green
    }
    else {
        Write-Warning "Schema backup may have failed (exit code: $LASTEXITCODE)"
    }

    # Backup data
    $dataFile = Join-Path $BACKUP_DIR "backup_${timestamp}_data.sql"
    Write-Host "Backing up data to: $dataFile" -ForegroundColor Yellow
    npx supabase db dump --linked -s public --data-only -f $dataFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Data backup complete" -ForegroundColor Green
    }
    else {
        Write-Warning "Data backup may have failed (exit code: $LASTEXITCODE)"
    }
}
finally {
    Pop-Location
}

# Summary
Write-Host ""
Write-Host "=== Backup Complete ===" -ForegroundColor Green

# List recent backups
Write-Host ""
Write-Host "Recent backups in $BACKUP_DIR :" -ForegroundColor Cyan
Get-ChildItem $BACKUP_DIR -Filter "backup_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 10 | ForEach-Object {
    $size = if ($_.Length -lt 1KB) { "$($_.Length) B" } 
    elseif ($_.Length -lt 1MB) { "$([math]::Round($_.Length / 1KB, 2)) KB" }
    else { "$([math]::Round($_.Length / 1MB, 2)) MB" }
    Write-Host "  $($_.Name) - $size - $($_.LastWriteTime)"
}

