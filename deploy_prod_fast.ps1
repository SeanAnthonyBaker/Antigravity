# deploy_prod_fast.ps1
Write-Host "Starting FAST Production Deployment..." -ForegroundColor Cyan

# 1. Deploy Backend
Write-Host "Deploying Backend..." -ForegroundColor Yellow
Set-Location ".\ManausNotebookLM-baseline"
.\deploy_fast.ps1
if ($LASTEXITCODE -ne 0) { Write-Error "Backend deployment failed"; exit 1 }

# 2. Deploy Frontend
Write-Host "Deploying Frontend..." -ForegroundColor Yellow
Set-Location "..\node-hierarchy-manager"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed"; exit 1 }
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { Write-Error "Firebase deploy failed"; exit 1 }

Set-Location ".."
Write-Host "FAST Production Deployment Complete!" -ForegroundColor Green
