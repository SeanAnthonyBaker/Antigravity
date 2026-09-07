# Access Microsoft Project for the web via Dataverse API
# This script retrieves your "Tulkah.AI 6 Week Value Roadmap" project data

Write-Host "Accessing Microsoft Project for the web via Dataverse API..." -ForegroundColor Cyan
Write-Host ""

# Your environment details
$dataverseUrl = "https://org54ad8b05ea0bef119f85002248c656a2.crm.dynamics.com"
$projectId = "fe864a34-8a67-4ed4-bdaf-806faaccc9c3"
$tenantId = "2bec83ec-133e-4dff-b5e4-45045d92b1c8"

# Step 1: Get access token using Azure CLI
Write-Host "Step 1: Getting Dataverse access token..." -ForegroundColor Yellow

# Check if logged in to Azure CLI
try {
    $null = az account show 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Not logged in to Azure CLI. Logging in..." -ForegroundColor Yellow
        az login --tenant $tenantId
    }
}
catch {
    Write-Host "Not logged in to Azure CLI. Logging in..." -ForegroundColor Yellow
    az login --tenant $tenantId
}

# Get token for Dataverse
$token = az account get-access-token --resource="$dataverseUrl" --query accessToken -o tsv

if ($token) {
    Write-Host "✅ Successfully obtained access token!" -ForegroundColor Green
    Write-Host ""
    
    # Step 2: Set up API headers
    $headers = @{
        "Authorization"    = "Bearer $token"
        "Content-Type"     = "application/json"
        "OData-MaxVersion" = "4.0"
        "OData-Version"    = "4.0"
        "Prefer"           = "return=representation"
    }
    
    # Step 3: Get all projects
    Write-Host "Step 2: Retrieving all projects..." -ForegroundColor Yellow
    $projectsUrl = "$dataverseUrl/api/data/v9.2/msdyn_projects"
    
    try {
        $projects = Invoke-RestMethod -Uri $projectsUrl -Headers $headers -Method Get
        
        Write-Host "✅ Found $($projects.value.Count) project(s):" -ForegroundColor Green
        Write-Host ""
        
        foreach ($proj in $projects.value) {
            Write-Host "📋 Project: $($proj.msdyn_subject)" -ForegroundColor Cyan
            Write-Host "   ID: $($proj.msdyn_project id)" -ForegroundColor Gray
            Write-Host "   Created: $($proj.createdon)" -ForegroundColor Gray
            Write-Host ""
        }
        
        # Step 4: Get tasks for your specific project
        Write-Host "Step 3: Retrieving tasks for your project..." -ForegroundColor Yellow
        
        # Build URL with proper encoding
        $tasksBaseUrl = "$dataverseUrl/api/data/v9.2/msdyn_projecttasks"
        $filter = "_msdyn_project_value eq $projectId"
        $encodedFilter = [System.Web.HttpUtility]::UrlEncode($filter)
        $tasksUrl = "$tasksBaseUrl`?`$filter=$filter`&`$orderby=msdyn_scheduledstart asc"
        
        $tasks = Invoke-RestMethod -Uri $tasksUrl -Headers $headers -Method Get
        
        Write-Host "✅ Found $($tasks.value.Count) task(s) in your project:" -ForegroundColor Green
        Write-Host ""
        
        if ($tasks.value.Count -gt 0) {
            foreach ($task in $tasks.value) {
                $status = if ($task.msdyn_progress -eq 100) { "✅" } elseif ($task.msdyn_progress -gt 0) { "🔄" } else { "⏳" }
                Write-Host "$status $($task.msdyn_subject)" -ForegroundColor White
                Write-Host "   Progress: $($task.msdyn_progress)%" -ForegroundColor Gray
                if ($task.msdyn_scheduledstart) {
                    Write-Host "   Start: $($task.msdyn_scheduledstart)" -ForegroundColor Gray
                }
                if ($task.msdyn_scheduledend) {
                    Write-Host "   End: $($task.msdyn_scheduledend)" -ForegroundColor Gray
                }
                Write-Host ""
            }
        }
        else {
            Write-Host "No tasks found in this project." -ForegroundColor Yellow
        }
        
        # Export to JSON
        Write-Host "Exporting data to JSON..." -ForegroundColor Yellow
        $exportData = @{
            projects = $projects.value
            tasks    = $tasks.value
        }
        $outputPath = Join-Path (Get-Location) "project_data.json"
        $exportData | ConvertTo-Json -Depth 10 | Out-File $outputPath -Encoding UTF8
        Write-Host "✅ Data exported to: $outputPath" -ForegroundColor Green
        
    }
    catch {
        Write-Host "❌ Error accessing Dataverse API: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "1. Ensure Dynamics CRM permission is granted and admin consent given" -ForegroundColor White
        Write-Host "2. Log out and back in: m365 logout && m365 login --authType browser" -ForegroundColor White
        Write-Host "3. Refresh Azure CLI: az logout && az login --tenant $tenantId" -ForegroundColor White
        Write-Host "4. Try again in a few minutes (permissions may take time to propagate)" -ForegroundColor White
    }
}
else {
    Write-Host "❌ Failed to get access token" -ForegroundColor Red
    Write-Host "Please ensure you're logged in: az login --tenant $tenantId" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 API access test complete!" -ForegroundColor Green
