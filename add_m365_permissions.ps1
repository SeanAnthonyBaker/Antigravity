# Add M365 CLI API Permissions
# This script adds comprehensive Microsoft Graph and SharePoint permissions to the M365 CLI app

$appId = "c88b1b1d-bd08-4007-be32-50d17e06f2a8"

Write-Host "Installing Microsoft.Graph PowerShell module if needed..." -ForegroundColor Cyan
if (!(Get-Module -ListAvailable -Name Microsoft.Graph.Applications)) {
    Install-Module Microsoft.Graph.Applications -Scope CurrentUser -Force
}

Write-Host "Connecting to Microsoft Graph..." -ForegroundColor Cyan
Connect-MgGraph -Scopes "Application.ReadWrite.All", "AppRoleAssignment.ReadWrite.All"

Write-Host "Getting app registration..." -ForegroundColor Cyan
$app = Get-MgApplication -Filter "appId eq '$appId'"

if (!$app) {
    Write-Host "Error: App not found with ID $appId" -ForegroundColor Red
    exit 1
}

Write-Host "Found app: $($app.DisplayName)" -ForegroundColor Green

# Microsoft Graph API Resource ID
$graphResourceId = "00000003-0000-0000-c000-000000000000"

# SharePoint API Resource ID  
$sharePointResourceId = "00000003-0000-0ff1-ce00-000000000000"

# Get Microsoft Graph Service Principal
$graphSp = Get-MgServicePrincipal -Filter "appId eq '$graphResourceId'"

# Get SharePoint Service Principal
$spSp = Get-MgServicePrincipal -Filter "appId eq '$sharePointResourceId'"

# Define permissions to add
$graphPermissions = @(
    @{Name = "Sites.ReadWrite.All"; Type = "Scope" },
    @{Name = "Group.ReadWrite.All"; Type = "Scope" },
    @{Name = "User.Read.All"; Type = "Scope" },
    @{Name = "Directory.Read.All"; Type = "Scope" },
    @{Name = "Tasks.ReadWrite"; Type = "Scope" },
    @{Name = "Team.ReadBasic.All"; Type = "Scope" },
    @{Name = "Channel.ReadBasic.All"; Type = "Scope" },
    @{Name = "Files.ReadWrite.All"; Type = "Scope" }
)

$sharePointPermissions = @(
    @{Name = "AllSites.FullControl"; Type = "Scope" },
    @{Name = "AllSites.Manage"; Type = "Scope" }
)

# Get current required resource access
$requiredResourceAccess = $app.RequiredResourceAccess

# Initialize if null
if (!$requiredResourceAccess) {
    $requiredResourceAccess = @()
}

# Process Microsoft Graph permissions
Write-Host "`nAdding Microsoft Graph permissions..." -ForegroundColor Cyan
$graphResourceAccess = @()

foreach ($perm in $graphPermissions) {
    $permission = $graphSp.Oauth2PermissionScopes | Where-Object { $_.Value -eq $perm.Name }
    if ($permission) {
        Write-Host "  - $($perm.Name)" -ForegroundColor Yellow
        $graphResourceAccess += @{
            Id   = $permission.Id
            Type = $perm.Type
        }
    }
    else {
        Write-Host "  - $($perm.Name) [NOT FOUND]" -ForegroundColor Red
    }
}

# Process SharePoint permissions
Write-Host "`nAdding SharePoint permissions..." -ForegroundColor Cyan
$spResourceAccess = @()

foreach ($perm in $sharePointPermissions) {
    $permission = $spSp.Oauth2PermissionScopes | Where-Object { $_.Value -eq $perm.Name }
    if ($permission) {
        Write-Host "  - $($perm.Name)" -ForegroundColor Yellow
        $spResourceAccess += @{
            Id   = $permission.Id
            Type = $perm.Type
        }
    }
    else {
        Write-Host "  - $($perm.Name) [NOT FOUND]" -ForegroundColor Red
    }
}

# Build required resource access array
$newResourceAccess = @(
    @{
        ResourceAppId  = $graphResourceId
        ResourceAccess = $graphResourceAccess
    },
    @{
        ResourceAppId  = $sharePointResourceId
        ResourceAccess = $spResourceAccess
    }
)

# Update the application
Write-Host "`nUpdating application permissions..." -ForegroundColor Cyan
try {
    Update-MgApplication -ApplicationId $app.Id -RequiredResourceAccess $newResourceAccess
    Write-Host "Successfully updated permissions!" -ForegroundColor Green
    
    Write-Host "`n⚠️  IMPORTANT: You must grant admin consent in Azure Portal" -ForegroundColor Yellow
    Write-Host "Visit: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$appId" -ForegroundColor Cyan
    Write-Host "Click 'Grant admin consent for [Tenant]'" -ForegroundColor Cyan
    
    Write-Host "`nAfter granting consent, re-authenticate M365 CLI:" -ForegroundColor Yellow
    Write-Host "  m365 logout" -ForegroundColor White
    Write-Host "  m365 login --authType browser" -ForegroundColor White
    
}
catch {
    Write-Host "Error updating permissions: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`nDisconnecting from Microsoft Graph..." -ForegroundColor Cyan
Disconnect-MgGraph
Write-Host "Done!" -ForegroundColor Green
