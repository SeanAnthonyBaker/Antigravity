# Find Planner Plan Owner Script
# Searches all Microsoft 365 groups to find which one owns the "Tulkah.AI 6 Week Value Roadmap" plan

Write-Host "Searching for 'Tulkah.AI 6 Week Value Roadmap' plan..." -ForegroundColor Cyan
Write-Host ""

# Get all Microsoft 365 groups
Write-Host "Getting all Microsoft 365 groups..." -ForegroundColor Yellow
$groupsJson = m365 entra m365group list --output json
$groups = $groupsJson | ConvertFrom-Json

Write-Host "Found $($groups.Count) groups. Checking each for plans..." -ForegroundColor Yellow
Write-Host ""

# Search each group for the plan
$found = $false
foreach ($group in $groups) {
    Write-Host "Checking group: $($group.displayName)..." -ForegroundColor Gray
    
    try {
        $plansJson = m365 planner plan list --ownerGroupId $group.id --output json 2>&1
        
        if ($plansJson -and $plansJson -ne "") {
            $plans = $plansJson | ConvertFrom-Json
            
            foreach ($plan in $plans) {
                if ($plan.title -like "*Tulkah*" -or $plan.title -like "*6 Week*") {
                    Write-Host ""
                    Write-Host "================================" -ForegroundColor Green
                    Write-Host "FOUND IT!" -ForegroundColor Green
                    Write-Host "================================" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "Plan Title: $($plan.title)" -ForegroundColor Cyan
                    Write-Host "Plan ID: $($plan.id)" -ForegroundColor Cyan
                    Write-Host "Owner Group: $($group.displayName)" -ForegroundColor Cyan
                    Write-Host "Group ID: $($group.id)" -ForegroundColor Cyan
                    Write-Host "Created: $($plan.createdDateTime)" -ForegroundColor Cyan
                    Write-Host ""
                    Write-Host "To list tasks in this plan, run:" -ForegroundColor Yellow
                    Write-Host "  m365 planner task list --planId `"$($plan.id)`"" -ForegroundColor White
                    Write-Host ""
                    
                    $found = $true
                }
            }
        }
    }
    catch {
        # Ignore errors for groups without plans
    }
}

if (-not $found) {
    Write-Host ""
    Write-Host "Plan not found in any group." -ForegroundColor Red
    Write-Host "The plan may be in a private group or you may need additional permissions." -ForegroundColor Yellow
}
