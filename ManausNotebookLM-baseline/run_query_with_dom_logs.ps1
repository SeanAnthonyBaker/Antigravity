# Run a query and capture DOM snapshots
# Usage: .\run_query_with_dom_logs.ps1

Write-Host "🚀 Sending query to NotebookLM with DOM logging enabled..." -ForegroundColor Cyan
Write-Host ""

# Start tailing logs in background
$logJob = Start-Job -ScriptBlock {
    param($zone, $vm)
    gcloud compute ssh $vm --zone=$zone --command="sudo docker logs notebooklm-backend-app-1 --follow"
} -ArgumentList "us-central1-a", "notebooklm-backend-vm"

Write-Host "📋 Started log monitoring (Job ID: $($logJob.Id))" -ForegroundColor Gray
Start-Sleep -Seconds 2

# Send the query
Write-Host "📤 Sending query..." -ForegroundColor Yellow
$body = '{"query":"Summarize the key points of this notebook","notebooklm_url":"https://notebooklm.google.com/notebook/76e3b771-785e-4003-abfe-994666cfd3c2","timeout":180}'

try {
    $response = Invoke-WebRequest -Uri "http://136.114.0.39:5000/api/process_query" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 200
    
    Write-Host ""
    Write-Host "✅ Query completed!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Gray
}
catch {
    Write-Host ""
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

# Wait for logs to finish streaming
Start-Sleep -Seconds 5

# Stop log monitoring
Write-Host ""
Write-Host "📊 Stopping log monitor and retrieving DOM snapshots..." -ForegroundColor Cyan
Stop-Job $logJob
Remove-Job $logJob

# Now get the DOM snapshot logs
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "DOM SNAPSHOT LOGS:" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan

gcloud compute ssh notebooklm-backend-vm --zone=us-central1-a --command="sudo docker logs notebooklm-backend-app-1 2>&1 | grep -A 10 'DOM SNAPSHOT'"

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "✅ Done!" -ForegroundColor Green
