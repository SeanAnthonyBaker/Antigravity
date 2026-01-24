$VM_NAME = "notebooklm-backend-vm"
$ZONE = "us-central1-a"
$REMOTE_USER = "seanb"
$APP_DIR = "/home/ubuntu/notebooklm-backend"

$FILES = @("Dockerfile", "Dockerfile.selenium", "entrypoint-selenium.sh", "notebooklm.py", "main.py", "grok.py", "deepseek.py", "user.py", "models.py", "requirements.txt", "docker-compose.yml", "mcp_bp.py")

Write-Host "Starting Optimized Deployment to $VM_NAME..." -ForegroundColor Cyan

# 1. Bundle Application Files
Write-Host "Bundling application files..." -ForegroundColor Yellow
# Create a tarball of the application files
tar -czf app_bundle.tar.gz $FILES
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create app_bundle.tar.gz"; exit 1 }

# 2. Bundle MCP
Write-Host "Bundling MCP..." -ForegroundColor Yellow
tar --exclude='.venv' --exclude='.git' --exclude='.chrome-auth-profile' --exclude='__pycache__' -czf notebooklm-mcp.tar.gz -C .. notebooklm-mcp
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create notebooklm-mcp.tar.gz"; exit 1 }

# 3. Upload Bundles
Write-Host "Uploading bundles..." -ForegroundColor Yellow
# Upload both tarballs in a single connection
gcloud compute scp app_bundle.tar.gz notebooklm-mcp.tar.gz "$($VM_NAME):/home/$REMOTE_USER/" --zone=$ZONE
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Upload failed!"
    Remove-Item app_bundle.tar.gz
    Remove-Item notebooklm-mcp.tar.gz
    exit 1 
}

# Cleanup Local
Remove-Item app_bundle.tar.gz
Remove-Item notebooklm-mcp.tar.gz

# 4. Remote Execution
Write-Host "Executing remote update..." -ForegroundColor Yellow
$remote_cmds = @(
    # Unpack App Bundle
    "sudo mv /home/$REMOTE_USER/app_bundle.tar.gz $APP_DIR/",
    "sudo chown ubuntu:ubuntu $APP_DIR/app_bundle.tar.gz",
    "cd $APP_DIR",
    "sudo tar -xzf app_bundle.tar.gz",
    "sudo rm app_bundle.tar.gz",
    "sudo chown ubuntu:ubuntu *",
    "sudo chmod +x entrypoint-selenium.sh",

    # Unpack MCP
    "sudo rm -rf /home/ubuntu/notebooklm-mcp",
    "sudo tar -xzf /home/$REMOTE_USER/notebooklm-mcp.tar.gz -C /home/ubuntu/",
    "sudo chown -R ubuntu:ubuntu /home/ubuntu/notebooklm-mcp",
    "rm /home/$REMOTE_USER/notebooklm-mcp.tar.gz",

    # Rebuild
    "sudo docker compose down",
    "sudo docker compose up -d --build"
)

$CMD = $remote_cmds -join " && "

gcloud compute ssh $VM_NAME --zone=$ZONE --command=$CMD

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment Complete!" -ForegroundColor Green
} else {
    Write-Error "Remote command failed!"
}
