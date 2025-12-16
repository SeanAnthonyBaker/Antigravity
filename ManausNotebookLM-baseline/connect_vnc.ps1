# Connect to VNC on the Cloud VM
# This script opens a secure SSH tunnel to the notebooklm-backend-vm.
# It forwards local port 7900 to the remote VNC port 7900.

$VM_NAME = "notebooklm-backend-vm"
$ZONE = "us-central1-a"

Write-Host "🔌 Establishing secure VNC tunnel to $VM_NAME..." -ForegroundColor Cyan
Write-Host "   Once connected, open your browser to: http://localhost:7900" -ForegroundColor Yellow
Write-Host "   Password: secret" -ForegroundColor Yellow
Write-Host "   (Keep this window open while using VNC)" -ForegroundColor Gray

# The -L flag binds port 7900 on localhost to port 7900 on the VM
gcloud compute ssh $VM_NAME --zone=$ZONE -- -L 7900:localhost:7900
