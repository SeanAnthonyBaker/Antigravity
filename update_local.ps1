# update_local.ps1
Write-Host "Starting Local Environment Update..." -ForegroundColor Cyan

# 1. Update Frontend Dependencies
Write-Host "Updating Frontend Dependencies..." -ForegroundColor Yellow
Set-Location ".\node-hierarchy-manager"
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }

# 2. Rebuild Backend Containers
Write-Host "Rebuilding Backend Containers..." -ForegroundColor Yellow
Set-Location "..\ManausNotebookLM-baseline"
docker compose down
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Write-Error "Docker rebuild failed"; exit 1 }

Set-Location ".."
Write-Host "Local Update Complete!" -ForegroundColor Green
