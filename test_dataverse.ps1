# Access Project for the web via Dataverse API using M365 CLI token
Write-Host "Testing Dataverse API Access..." -ForegroundColor Cyan
Write-Host ""

$dataverseUrl = "https://org54ad8b05ea0bef119f85002248c656a2.crm.dynamics.com"

# Use M365 CLI to get token (it's already logged in)
Write-Host "Step 1: Refreshing M365 CLI login..." -ForegroundColor Yellow
m365 logout
m365 login --authType browser

Write-Host ""
Write-Host "Step 2: Getting Dataverse access token..." -ForegroundColor Yellow

# Get M365 access token
$tokenJson = m365 util accesstoken get --resource $dataverseUrl --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $token = ($tokenJson | ConvertFrom-Json)
    Write-Host "✅ Got access token!" -ForegroundColor Green
    Write-Host ""
    
    # Test API call
    $headers = @{
        "Authorization"    = "Bearer $token"
        "Content-Type"     = "application/json"
        "OData-MaxVersion" = "4.0"
        "OData-Version"    = "4.0"
    }
    
    Write-Host "Step 3: Fetching your Project for the web data..." -ForegroundColor Yellow
    $projectsUrl = "$dataverseUrl/api/data/v9.2/msdyn_projects"
    
    try {
        $result = Invoke-RestMethod -Uri $projectsUrl -Headers $headers -Method Get
        
        Write-Host "✅ SUCCESS! Found $($result.value.Count) projects:" -ForegroundColor Green
        Write-Host ""
        
        foreach ($p in $result.value) {
            Write-Host "📋 $($p.msdyn_subject)" -ForegroundColor Cyan
            Write-Host "   ID: $($p.msdyn_projectid)" -ForegroundColor Gray
            Write-Host ""
        }
        
        # Save to file
        $result | ConvertTo-Json -Depth 10 | Out-File "projects.json" -Encoding UTF8
        Write-Host "✅ Data saved to: projects.json" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 Dataverse API is working!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Response details:" -ForegroundColor Yellow
        if ($_.ErrorDetails) {
            Write-Host $_.ErrorDetails.Message -ForegroundColor Gray
        }
    }
}
else {
    Write-Host "❌ Could not get access token" -ForegroundColor Red
    Write-Host "Error: $tokenJson" -ForegroundColor Gray
}
