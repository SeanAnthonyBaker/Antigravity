# deploy_prod.ps1
Write-Host "Starting Production Deployment..." -ForegroundColor Cyan

# 1. Deploy Backend
Write-Host "Deploying Backend to Cloud VM..." -ForegroundColor Yellow
Set-Location ".\ManausNotebookLM-baseline"
.\deploy_full_update.ps1
if ($LASTEXITCODE -ne 0) { Write-Error "Backend deployment failed"; exit 1 }

# 2. Deploy Frontend
Write-Host "Build and Deploy Frontend to Firebase..." -ForegroundColor Yellow
Set-Location "..\node-hierarchy-manager"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed"; exit 1 }
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { Write-Error "Firebase deploy failed"; exit 1 }

Set-Location ".."
Write-Host "Production Deployment Complete!" -ForegroundColor Green
