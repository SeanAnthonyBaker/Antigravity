$ErrorActionPreference = "Stop"

Write-Host "Starting Local Deployment..." -ForegroundColor Cyan

# 0. Ensure NotebookLM Authentication via nlm CLI
$NLM_PATH = "C:\Users\seanb\.local\bin\nlm.exe"
if (Test-Path $NLM_PATH) {
    Write-Host "Checking NotebookLM authentication..." -ForegroundColor Cyan
    
    # Set UTF-8 encoding to avoid Unicode errors
    $env:PYTHONIOENCODING = "utf-8"
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    
    & $NLM_PATH login --check 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Not logged in. Opening authentication..." -ForegroundColor Yellow
        & $NLM_PATH login 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Authentication failed. Aborting deployment."
        }
    }
    Write-Host "Authentication verified." -ForegroundColor Green
}
else {
    Write-Warning "nlm CLI not found. Skipping auth check."
    Write-Warning "Install with: pipx install notebooklm-cli"
}

# 1. Check for .env
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" -Destination ".env"
        Write-Host "Created .env from .env.example." -ForegroundColor Yellow
    }
    else {
        Write-Error "CRITICAL: No .env found!"
    }
}

# 2. Check for .gcloud (Standard check for this project's Selenium setup)
if (-not (Test-Path ".gcloud")) {
    Write-Warning ".gcloud directory not found. Selenium authentication might fail if credentials are required."
}

# 3. Ensure chrome-data exists (Volume mount point)
if (-not (Test-Path "chrome-data")) {
    New-Item -ItemType Directory -Force -Path "chrome-data" | Out-Null
    Write-Host "Created chrome-data volume directory." -ForegroundColor Green
}

# 4. Docker Operations
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker compose down --remove-orphans

Write-Host "Building and starting containers..." -ForegroundColor Cyan
docker compose up -d --build

if ($?) {
    Write-Host "Deployment Successful!" -ForegroundColor Green
    Write-Host "App Status: http://localhost:5000/api/status"
    Write-Host "Selenium Hub: http://localhost:4444"
    Write-Host "Tailing logs (Ctrl+C to stop)..." -ForegroundColor Gray
    Start-Sleep -Seconds 2
    docker compose logs -f
}
else {
    Write-Error "Deployment failed."
}
