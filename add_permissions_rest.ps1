# Simplified approach: Add permissions using Microsoft Graph REST API via Invoke-RestMethod
# This uses your current M365 CLI authentication token

param(
    [string]$AppId = "c88b1b1d-bd08-4007-be32-50d17e06f2a8"
)

Write-Host "Getting access token from M365 CLI..." -ForegroundColor Cyan

# Get the access token from M365 CLI
$tokenOutput = m365 util accesstoken get --resource https://graph.microsoft.com --output text 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to get access token. Please ensure M365 CLI is logged in." -ForegroundColor Red
    Write-Host "Run: m365 login --authType browser" -ForegroundColor Yellow
    exit 1
}

$accessToken = $tokenOutput.Trim()
Write-Host "Access token obtained successfully" -ForegroundColor Green

# Set up headers
$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type"  = "application/json"
}

# Get the application object ID
Write-Host "`nGetting application object..." -ForegroundColor Cyan
try {
    $appUrl = "https://graph.microsoft.com/v1.0/applications?`$filter=appId eq '$AppId'"
    $appResponse = Invoke-RestMethod -Uri $appUrl -Headers $headers -Method Get
    
    if ($appResponse.value.Count -eq 0) {
        Write-Host "Error: Application not found" -ForegroundColor Red
        exit 1
    }
    
    $app = $appResponse.value[0]
    $objectId = $app.id
    Write-Host "Found app: $($app.displayName) (Object ID: $objectId)" -ForegroundColor Green
}
catch {
    Write-Host "Error getting application: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Microsoft Graph Service Principal ID
$graphAppId = "00000003-0000-0000-c000-000000000000"

# SharePoint Service Principal ID
$sharePointAppId = "00000003-0000-0ff1-ce00-000000000000"

# Get Microsoft Graph Service Principal to find permission IDs
Write-Host "`nGetting Microsoft Graph service principal..." -ForegroundColor Cyan
$graphSpUrl = "https://graph.microsoft.com/v1.0/servicePrincipals?`$filter=appId eq '$graphAppId'"
$graphSp = (Invoke-RestMethod -Uri $graphSpUrl -Headers $headers -Method Get).value[0]

# Get SharePoint Service Principal
Write-Host "Getting SharePoint service principal..." -ForegroundColor Cyan
$spSpUrl = "https://graph.microsoft.com/v1.0/servicePrincipals?`$filter=appId eq '$sharePointAppId'"
$spSp = (Invoke-RestMethod -Uri $spSpUrl -Headers $headers -Method Get).value[0]

# Define permission names we want to add
$desiredGraphPermissions = @(
    "Sites.ReadWrite.All",
    "Group.ReadWrite.All",
    "User.Read.All",
    "Directory.Read.All",
    "Tasks.ReadWrite",
    "Team.ReadBasic.All",
    "Channel.ReadBasic.All",
    "Files.ReadWrite.All"
)

$desiredSharePointPermissions = @(
    "AllSites.FullControl",
    "AllSites.Manage"
)

# Build resource access arrays
Write-Host "`nBuilding permission request..." -ForegroundColor Cyan
$graphResourceAccess = @()
foreach ($permName in $desiredGraphPermissions) {
    $perm = $graphSp.oauth2PermissionScopes | Where-Object { $_.value -eq $permName }
    if ($perm) {
        Write-Host "  + $permName" -ForegroundColor Yellow
        $graphResourceAccess += @{
            id   = $perm.id
            type = "Scope"
        }
    }
}

$spResourceAccess = @()
foreach ($permName in $desiredSharePointPermissions) {
    $perm = $spSp.oauth2PermissionScopes | Where-Object { $_.value -eq $permName }
    if ($perm) {
        Write-Host "  + $permName" -ForegroundColor Yellow
        $spResourceAccess += @{
            id   = $perm.id
            type = "Scope"
        }
    }
}

# Build the update payload
$updateBody = @{
    requiredResourceAccess = @(
        @{
            resourceAppId  = $graphAppId
            resourceAccess = $graphResourceAccess
        },
        @{
            resourceAppId = $sharePointAppId
            resource      = $spResourceAccess
        }
    )
} | ConvertTo-Json -Depth 10

# Update the application
Write-Host "`nUpdating application permissions..." -ForegroundColor Cyan
try {
    $updateUrl = "https://graph.microsoft.com/v1.0/applications/$objectId"
    $updateResponse = Invoke-RestMethod -Uri $updateUrl -Headers $headers -Method Patch -Body $updateBody
    Write-Host "✅ Successfully added permissions!" -ForegroundColor Green
    
    Write-Host "`n⚠️  Next step: Grant admin consent" -ForegroundColor Yellow
    Write-Host "Visit: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$AppId" -ForegroundColor Cyan
    Write-Host "Click 'Grant admin consent for [Tenant]'" -ForegroundColor Cyan
    
}
catch {
    Write-Host "Error updating permissions: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}

Write-Host "`nDone!" -ForegroundColor Green
