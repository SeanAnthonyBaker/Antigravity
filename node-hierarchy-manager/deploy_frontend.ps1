$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Frontend Production Deployment" -ForegroundColor Cyan

# Clean previous build
Write-Host "`n🧹 Cleaning previous build..." -ForegroundColor Yellow
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# Build with production environment
Write-Host "`n🔨 Building with production environment..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Build failed!"
    exit 1
}

# Verify environment was loaded
Write-Host "`n🔍 Verifying production API URL in build..." -ForegroundColor Yellow
$jsFiles = Get-ChildItem -Path "dist/assets" -Filter "index-*.js"
$found = $false

foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match "136\.114\.0\.39\.nip\.io") {
        Write-Host "✅ Production API URL detected in $($file.Name)" -ForegroundColor Green
        $found = $true
        break
    }
}

if (-not $found) {
    Write-Error "❌ Build verification failed: Production API URL not found in bundle"
    Write-Host "Expected to find: 136.114.0.39.nip.io" -ForegroundColor Red
    exit 1
}

# Deploy to Firebase
Write-Host "`n🌐 Deploying to Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deployment Complete!" -ForegroundColor Green
    Write-Host "Visit: https://notebooklm-selenium.web.app" -ForegroundColor Cyan
}
else {
    Write-Error "❌ Firebase deployment failed!"
    exit 1
}
