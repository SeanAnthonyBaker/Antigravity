# Test NotebookLM Query API
# This script sends a query to your NotebookLM automation backend

$vmIp = "136.114.0.39"
$notebookId = "76e3b771-785e-4003-abfe-994666cfd3c2"

Write-Host "🔍 Testing NotebookLM API at http://$vmIp:5000" -ForegroundColor Cyan
Write-Host ""

# First, check status
Write-Host "1️⃣ Checking server status..." -ForegroundColor Yellow
try {
    $statusResponse = Invoke-WebRequest -Uri "http://$vmIp:5000/api/status" -Method GET
    Write-Host "✅ Server is running!" -ForegroundColor Green
    Write-Host "   Status: $($statusResponse.StatusCode)" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "❌ Server not responding: $_" -ForegroundColor Red
    exit 1
}

# Now send the query
Write-Host "2️⃣ Sending query to NotebookLM..." -ForegroundColor Yellow
Write-Host "   Notebook: $notebookId" -ForegroundColor Gray
Write-Host ""

$body = @{
    query          = "Summarize the key points of this notebook"
    notebooklm_url = "https://notebooklm.google.com/notebook/$notebookId"
    timeout        = 180
} | ConvertTo-Json

Write-Host "📤 Request body:" -ForegroundColor Cyan
Write-Host $body -ForegroundColor Gray
Write-Host ""

try {
    Write-Host "⏳ Waiting for response (this may take up to 3 minutes)..." -ForegroundColor Yellow
    
    $response = Invoke-WebRequest -Uri "http://$vmIp:5000/api/process_query" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 200
    
    Write-Host ""
    Write-Host "✅ Response received!" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📄 Response Content:" -ForegroundColor Cyan
    Write-Host $response.Content
    
}
catch {
    Write-Host ""
    Write-Host "❌ Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Gray
    }
}
