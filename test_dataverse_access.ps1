# Verify Dataverse Access and Get Project Data
# This script tests Dataverse API connectivity and retrieves your Project for the web data

Write-Host "Testing Dataverse Access..." -ForegroundColor Cyan
Write-Host ""

# Your Dataverse environment details
$envId = "54ad8b05-ea0b-ef11-9f85-002248c656a2"
$projectId = "fe864a34-8a67-4ed4-bdaf-806faaccc9c3"
$orgUrl = "https://org54ad8b05ea0bef119f85002248c656a2.crm.dynamics.com"

Write-Host "Environment ID: $envId" -ForegroundColor Yellow
Write-Host "Project ID: $projectId" -ForegroundColor Yellow
Write-Host "Dataverse URL: $orgUrl" -ForegroundColor Yellow
Write-Host ""

# Method 1: Try using M365 CLI to get an access token for Dataverse
Write-Host "Getting access token for Dataverse..." -ForegroundColor Cyan
try {
    # Use Azure CLI to get Dataverse token
    $token = az account get-access-token --resource="$orgUrl" --query accessToken -o tsv 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully got Dataverse access token!" -ForegroundColor Green
        Write-Host ""
        
        # Test API call to get projects
        Write-Host "Querying Project for the web data..." -ForegroundColor Cyan
        
        $headers = @{
            "Authorization"    = "Bearer $token"
            "Content-Type"     = "application/json"
            "OData-MaxVersion" = "4.0"
            "OData-Version"    = "4.0"
        }
        
        # Get all projects
        $projectsUrl = "$orgUrl/api/data/v9.2/msdyn_projects"
        $response = Invoke-RestMethod -Uri $projectsUrl -Headers $headers -Method Get
        
        Write-Host "✅ Successfully connected to Dataverse API!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Found $($response.value.Count) projects:" -ForegroundColor Yellow
        
        foreach ($project in $response.value) {
            Write-Host "  - $($project.msdyn_subject)" -ForegroundColor Cyan
            Write-Host "    ID: $($project.msdyn_projectid)" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "🎉 Dataverse is active and accessible!" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Could not get access token. Trying alternative method..." -ForegroundColor Yellow
        
        # Method 2: Check if user is logged in to Azure CLI
        Write-Host ""
        Write-Host "Checking Azure CLI login status..." -ForegroundColor Cyan
        az account show 2>$null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "You need to log in to Azure CLI first:" -ForegroundColor Yellow
            Write-Host "  az login --tenant 2bec83ec-133e-4dff-b5e4-45045d92b1c8" -ForegroundColor White
            Write-Host ""
            Write-Host "After logging in, run this script again." -ForegroundColor Yellow
        }
    }
}
catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Use Power Automate instead" -ForegroundColor Yellow
    Write-Host "  Visit: https://make.powerautomate.com" -ForegroundColor White
    Write-Host "  Use the 'Project for the web' connector" -ForegroundColor White
}

Write-Host ""
Write-Host "Your Dataverse environment is ready!" -ForegroundColor Green
Write-Host "Environment URL: https://make.powerapps.com/environments/$envId/home" -ForegroundColor Cyan
