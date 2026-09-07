# PowerShell Script to Access Microsoft Project OData API
# This script authenticates directly with the Project API and retrieves your projects

param(
    [string]$ClientId = "c88b1b1d-bd08-4007-be32-50d17e06f2a8",
    [string]$TenantId = "2bec83ec-133e-4dff-b5e4-45045d92b1c8"
)

Write-Host "Microsoft Project OData API Access Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check if MSAL.PS module is installed
if (-not (Get-Module -ListAvailable -Name MSAL.PS)) {
    Write-Host "`nInstalling MSAL.PS module..." -ForegroundColor Yellow
    Install-Module MSAL.PS -Scope CurrentUser -Force
}

# Import the module
Import-Module MSAL.PS

Write-Host "`nAuthenticating with Microsoft Project API..." -ForegroundColor Cyan

try {
    # Get access token for Project API
    $token = Get-MsalToken `
        -ClientId $ClientId `
        -TenantId $TenantId `
        -Scopes "https://project.microsoft.com/.default" `
        -Interactive `
        -ErrorAction Stop

    Write-Host "Authentication successful!" -ForegroundColor Green

    # Set up headers with bearer token
    $headers = @{
        "Authorization" = "Bearer $($token.AccessToken)"
        "Accept"        = "application/json"
    }

    Write-Host "`nFetching your projects..." -ForegroundColor Cyan

    # Query the Project OData API
    $response = Invoke-RestMethod `
        -Uri "https://project.microsoft.com/api/odata/v1/Projects" `
        -Method Get `
        -Headers $headers `
        -ErrorAction Stop

    # Display results
    if ($response.value -and $response.value.Count -gt 0) {
        Write-Host "`nFound $($response.value.Count) project(s):" -ForegroundColor Green
        
        foreach ($project in $response.value) {
            Write-Host "`nProject: $($project.Name)" -ForegroundColor Cyan
            Write-Host "  ID: $($project.Id)" -ForegroundColor Gray
            if ($project.Description) {
                Write-Host "  Description: $($project.Description)" -ForegroundColor Gray
            }
            Write-Host "  Created: $($project.CreatedDate)" -ForegroundColor Gray
            Write-Host "  Modified: $($project.ModifiedDate)" -ForegroundColor Gray
        }

        # Save to JSON file
        $outputFile = "projects_export_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
        $response.value | ConvertTo-Json -Depth 10 | Out-File $outputFile
        Write-Host "`nFull project data saved to: $outputFile" -ForegroundColor Green

    }
    else {
        Write-Host "`nNo projects found" -ForegroundColor Yellow
    }

}
catch {
    Write-Host "`nError occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Message -like "*AADSTS65001*") {
        Write-Host "`nThis error indicates that admin consent is required." -ForegroundColor Yellow
        Write-Host "Please add Project API permissions in Azure Portal" -ForegroundColor Yellow
    }
    
    exit 1
}

Write-Host "`nScript completed successfully!" -ForegroundColor Green
