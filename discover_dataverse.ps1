# Discover Dataverse Environment URL
# Uses M365 CLI to find Power Platform environments

Write-Host "🔍 Discovering Dataverse Environments..." -ForegroundColor Cyan
Write-Host ""

# Check if M365 CLI is logged in
Write-Host "1️⃣ Checking M365 CLI authentication..." -ForegroundColor Yellow
try {
    $status = m365 status --output json | ConvertFrom-Json
    Write-Host "✅ Logged in as: $($status.connectedAs)" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "❌ Not logged in to M365 CLI" -ForegroundColor Red
    Write-Host "Run: m365 login --authType browser" -ForegroundColor Yellow
    exit 1
}

# Try to get environments using Graph API
Write-Host "2️⃣ Querying Power Platform environments..." -ForegroundColor Yellow
Write-Host ""

# Method 1: Try Power Apps environments endpoint
try {
    Write-Host "Attempting Graph API query for environments..." -ForegroundColor Gray
    
    # Get access token for Power Platform
    $token = m365 util accesstoken get --resource https://api.bap.microsoft.com --output text
    
    # Query environments
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type"  = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=2020-10-01" -Headers $headers -Method Get
    
    if ($response.value.Count -gt 0) {
        Write-Host "✅ Found $($response.value.Count) environment(s):" -ForegroundColor Green
        Write-Host ""
        
        foreach ($env in $response.value) {
            $envName = $env.properties.displayName
            $envId = $env.name
            $envUrl = $env.properties.linkedEnvironmentMetadata.instanceUrl
            $envType = $env.properties.environmentSku
            
            Write-Host "📦 $envName" -ForegroundColor Cyan
            Write-Host "   ID: $envId" -ForegroundColor Gray
            Write-Host "   Type: $envType" -ForegroundColor Gray
            
            if ($envUrl) {
                Write-Host "   🌐 Dataverse URL: $envUrl" -ForegroundColor Green
                Write-Host "   API Endpoint: $envUrl/api/data/v9.2/" -ForegroundColor Yellow
            }
            else {
                Write-Host "   ⚠️  No Dataverse URL (likely no database)" -ForegroundColor Yellow
            }
            Write-Host ""
        }
        
        # Save to file
        $outputFile = "dataverse_environments.json"
        $response.value | ConvertTo-Json -Depth 10 | Out-File $outputFile
        Write-Host "💾 Full details saved to: $outputFile" -ForegroundColor Green
        
    }
    else {
        Write-Host "⚠️  No environments found" -ForegroundColor Yellow
    }
    
}
catch {
    Write-Host "❌ Error querying environments: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Alternative: Visit Power Platform Admin Center" -ForegroundColor Yellow
    Write-Host "   https://admin.powerplatform.microsoft.com/environments" -ForegroundColor Cyan
    Write-Host "   Look for 'Environment URL' in environment details" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Copy the Dataverse URL from above"
Write-Host "2. Update config.dataverseUrl in dataverse_api.js"
Write-Host "3. Run: node dataverse_api.js"
Write-Host "=" * 70 -ForegroundColor Gray
