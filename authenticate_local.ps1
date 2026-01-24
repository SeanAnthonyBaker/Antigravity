# authenticate_local.ps1
Write-Host "Starting Interactive Login for NotebookLM..." -ForegroundColor Cyan
Write-Host "This will open a Chrome window on your machine." -ForegroundColor Yellow
Write-Host "Please log in to NotebookLM in the opened window." -ForegroundColor Yellow

# Ensure we are in the root
if (Test-Path "notebooklm-mcp") {
    Set-Location "notebooklm-mcp"
}

# Run the auth tool using uv from the source directory
# This uses the python environment managed by uv to run the auth script
Try {
    uv run python -m notebooklm_mcp.auth_cli
}
Catch {
    Write-Error "Failed to run auth tool. Make sure 'uv' is installed."
    Exit 1
}

Write-Host "`nAuthentication Complete!" -ForegroundColor Green
Write-Host "Cookies have been saved to ~/.notebooklm-mcp/auth.json" -ForegroundColor Cyan
Write-Host "The Docker container will automatically pick up these changes." -ForegroundColor Cyan

# Return to root if we changed directory
if (Test-Path "../authenticate_local.ps1") {
    Set-Location ".."
}
