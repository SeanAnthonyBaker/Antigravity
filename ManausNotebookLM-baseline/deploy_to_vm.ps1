# Deployment Script for NotebookLM Backend

$VM_NAME = "notebooklm-backend-vm"
$ZONE = "us-central1-a"
$LOCAL_FILE = "notebooklm.py"
$REMOTE_DIR = "/home/ubuntu/notebooklm-backend"
$REMOTE_FILE = "$REMOTE_DIR/notebooklm.py"

Write-Host "🚀 Deploying $LOCAL_FILE to $VM_NAME ($ZONE)..." -ForegroundColor Cyan

# 1. Upload the file
Write-Host "1️⃣  Uploading $LOCAL_FILE..."
gcloud compute scp $LOCAL_FILE ${VM_NAME}:${REMOTE_FILE} --zone=$ZONE
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to upload file."
    exit 1
}

# 2. Move to app directory and restart container
Write-Host "2️⃣  Moving file and restarting 'app' service..."
$COMMAND = "sudo mv $REMOTE_FILE /home/ubuntu/notebooklm-backend/app/notebooklm.py && cd /home/ubuntu/notebooklm-backend && sudo docker-compose restart app"

gcloud compute ssh $VM_NAME --zone=$ZONE --command=$COMMAND
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to restart service."
    exit 1
}

Write-Host "✅ Deployment complete! The backend has been updated and restarted." -ForegroundColor Green
