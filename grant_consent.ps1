# Generate Admin Consent URL for M365 CLI App
# This allows granting consent for permissions without needing to modify the app registration first

$appId = "c88b1b1d-bd08-4007-be32-50d17e06f2a8"
$tenantId = "2bec83ec-133e-4dff-b5e4-45045d92b1c8"

# Permissions we want to request (space-separated list of scopes)
$graphScopes = @(
    "Sites.ReadWrite.All",
    "Group.ReadWrite.All",
    "User.Read.All",
    "Directory.Read.All",
    "Tasks.ReadWrite",
    "Team.ReadBasic.All",
    "Channel.ReadBasic.All",
    "Files.ReadWrite.All",
    "AllSites.FullControl",  # SharePoint
    "AllSites.Manage"         # SharePoint
) -join " "

# Build the admin consent URL
$redirectUri = "http://localhost"
$consentUrl = "https://login.microsoftonline.com/$tenantId/adminconsent?client_id=$appId&redirect_uri=$redirectUri&scope=$([System.Web.HttpUtility]::UrlEncode($graphScopes))"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "M365 CLI - Admin Consent URL" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Since we cannot modify the app registration directly," -ForegroundColor Yellow
Write-Host "we can request admin consent for the permissions." -ForegroundColor Yellow
Write-Host ""
Write-Host "Opening admin consent URL in browser..." -ForegroundColor Green
Write-Host ""
Write-Host $consentUrl -ForegroundColor White
Write-Host ""

# Open the URL in default browser
Start-Process $consentUrl

Write-Host ""
Write-Host "✅ Follow the prompts in your browser to grant consent" -ForegroundColor Green
Write-Host ""
Write-Host "After granting consent:" -ForegroundColor Yellow
Write-Host "  1. Ignore any redirect errors (expected)" -ForegroundColor White
Write-Host "  2. Run: m365 logout" -ForegroundColor White
Write-Host "  3. Run: m365 login --authType browser" -ForegroundColor White
Write-Host "  4. Test: m365 spo site list" -ForegroundColor White
Write-Host ""
