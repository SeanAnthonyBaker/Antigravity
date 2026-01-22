# start_local.ps1
Write-Host "Starting Antigravity Local Stack..." -ForegroundColor Cyan

# 1. Start Backend
Write-Host "Ensuring Backend is running (Docker)..." -ForegroundColor Yellow
Set-Location ".\ManausNotebookLM-baseline"
# Note: up -d starts them in background. 
docker compose up -d
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Backend failed to start. Ensure Docker Desktop is running."
    exit 1 
}

# 2. Start Frontend in a new window
Write-Host "Starting Frontend (Vite) in a separate window..." -ForegroundColor Yellow
Set-Location "..\node-hierarchy-manager"
# Opens a new PowerShell window to run the dev server so the root window remains usable
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"

# 3. Summary
Write-Host "`n--- Local Environment Status ---" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:5000/api/status" -ForegroundColor Cyan
Write-Host "VNC/Browser: http://localhost:7900 (Pass: secret)" -ForegroundColor Cyan
Write-Host "--------------------------------`n"

Set-Location ".."
