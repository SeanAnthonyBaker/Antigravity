# deploy_to_vm.ps1
# This script automates the deployment of notebooklm.py to the Google Cloud VM.
# It uses gcloud to handle authentication and keys automatically.

$VM_NAME = "notebooklm-backend-vm"
$ZONE = "us-central1-a"
$LOCAL_FILE = "notebooklm.py"
$REMOTE_USER = "seanb" # The user gcloud logs in as
$APP_DIR = "/home/ubuntu/notebooklm-backend"

Write-Host "🚀 Deploying $LOCAL_FILE to $VM_NAME ($ZONE)..." -ForegroundColor Cyan

# 1. Upload file to user's home directory
Write-Host "1️⃣  Uploading $LOCAL_FILE..." -ForegroundColor Yellow
gcloud compute scp $LOCAL_FILE "$($VM_NAME):/home/$REMOTE_USER/$LOCAL_FILE" --zone=$ZONE

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Upload failed! Please check your internet connection and gcloud login."
    exit 1
}

# 2. Move file to app directory and restart Docker service
Write-Host "2️⃣  Moving file and restarting 'app' service..." -ForegroundColor Yellow
$CMD = "sudo mv /home/$REMOTE_USER/$LOCAL_FILE $APP_DIR/$LOCAL_FILE && sudo chown ubuntu:ubuntu $APP_DIR/$LOCAL_FILE && cd $APP_DIR && sudo docker compose restart app"

gcloud compute ssh $VM_NAME --zone=$ZONE --command=$CMD

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Remote command failed!"
    exit 1
}

Write-Host "✅ Deployment complete! The backend has been updated and restarted." -ForegroundColor Green
