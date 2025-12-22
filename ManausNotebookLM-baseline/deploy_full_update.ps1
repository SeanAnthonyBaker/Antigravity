$VM_NAME = "notebooklm-backend-vm"
$ZONE = "us-central1-a"
$REMOTE_USER = "seanb"
$APP_DIR = "/home/ubuntu/notebooklm-backend"

$FILES = @("Dockerfile", "Dockerfile.selenium", "entrypoint-selenium.sh", "notebooklm.py", "main.py", "grok.py", "deepseek.py", "user.py", "models.py", "requirements.txt", "docker-compose.yml")

Write-Host "Deploying updates to $VM_NAME..." -ForegroundColor Cyan

# Check/Create Firewall Rule
Write-Host "Checking firewall rules..." -ForegroundColor Yellow
$FW_RULE = "allow-vnc-7900"
gcloud compute firewall-rules describe $FW_RULE --format="value(name)" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating firewall rule: $FW_RULE..." -ForegroundColor Yellow
    gcloud compute firewall-rules create $FW_RULE --allow tcp:7900 --target-tags=http-server --description="Allow VNC access"
}
else {
    Write-Host "Firewall rule $FW_RULE already exists." -ForegroundColor Green
}

foreach ($file in $FILES) {
    Write-Host "Uploading $file..." -ForegroundColor Yellow
    gcloud compute scp $file "$($VM_NAME):/home/$REMOTE_USER/$file" --zone=$ZONE
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Upload of $file failed!"
        exit 1
    }
}

Write-Host "Moving files and rebuilding Docker services..." -ForegroundColor Yellow

# Build the command string
$moveCommands = @()
foreach ($file in $FILES) {
    # Move file from user home to app dir
    $moveCommands += "sudo mv /home/$REMOTE_USER/$file $APP_DIR/"
}

# Add the final commands
$allCommands = $moveCommands + @(
    "sudo chown -R ubuntu:ubuntu $APP_DIR",
    "cd $APP_DIR",
    "sudo docker compose down",
    "sudo docker compose up -d --build"
)

# Join with AND operator for bash
$CMD = $allCommands -join " && "

# Execute on remote VM
gcloud compute ssh $VM_NAME --zone=$ZONE --command=$CMD

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment and Rebuild Complete!" -ForegroundColor Green
}
else {
    Write-Error "Remote command failed!"
}
