---
description: How to deploy the Selenium/Flask backend to a cloud VPS
---

# Deploying the NotebookLM Automation Backend to the Cloud

This guide explains how to host the `ManausNotebookLM-baseline` application on a cloud Virtual Private Server (VPS) so it can be accessed by your local or hosted frontend.

## 1. Provision a Cloud Server (VPS)

You will need a Linux server. Recommended specs:
- **OS:** Ubuntu 22.04 LTS (or similar)
- **CPU:** 2 vCPUs (Selenium needs resources)
- **RAM:** 4GB minimum (Chrome + Flask + Docker overhead)
- **Storage:** 20GB+

Providers: AWS (EC2 t3.medium), DigitalOcean (Droplet), Google Cloud (Compute Engine), Linode, etc.

## 2. Install Docker & Docker Compose

SSH into your new server and run the following commands to install Docker:

```bash
# Update packages
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
sudo docker run hello-world
```

## 3. Transfer Project Files

You need to copy the `ManausNotebookLM-baseline` directory to your server. You can use `scp` (Secure Copy) from your local machine:

```powershell
# Run this from your local machine's terminal
# Replace <your-server-ip> and <username> (usually 'ubuntu' or 'root')
scp -r "c:\Users\seanb\OneDrive\Documents\Tulkah.ai\Antigravity\ManausNotebookLM-baseline" <username>@<your-server-ip>:~/notebooklm-backend
```

Alternatively, if you have this pushed to a Git repository:
```bash
git clone <your-repo-url> notebooklm-backend
```

## 4. Configure Environment

1.  SSH into your server: `ssh <username>@<your-server-ip>`
2.  Navigate to the directory: `cd notebooklm-backend`
3.  Create/Edit your `.env` file:

```bash
nano .env
```

Paste your environment variables (copy them from your local `.env`):
```env
FLASK_SECRET_KEY=your_secure_random_key
CHROME_USER_AGENT=...
# Add other necessary variables
```

4.  **Important:** Ensure you have your Google Cloud credentials (`.gcloud` directory) if required by your setup. If you copied the whole folder in step 3, they should be there.

## 5. Start the Services

Run the application in detached mode:

```bash
sudo docker compose up -d --build
```

Check the logs to ensure everything started correctly:

```bash
sudo docker compose logs -f
```

## 6. Configure Firewall

Ensure port **5000** is open on your server's firewall so your frontend can reach it.
- **AWS:** Update Security Group to allow Inbound Custom TCP on port 5000 from `0.0.0.0/0` (or just your IP).
- **DigitalOcean/Linode:** Use `ufw` or the provider's dashboard.

```bash
# Example using UFW on Ubuntu
sudo ufw allow 5000/tcp
```

## 7. Connect Your Frontend

Now that the backend is running in the cloud, you need to tell your local frontend where to find it.

1.  Open `c:\Users\seanb\OneDrive\Documents\Tulkah.ai\Antigravity\node-hierarchy-manager\vite.config.ts` locally.
2.  Update the proxy target:

```typescript
// vite.config.ts
export default defineConfig({
  // ...
  server: {
    proxy: {
      '/api': {
        target: 'http://<YOUR_CLOUD_SERVER_IP>:5000', // Update this line
        changeOrigin: true,
      },
      // ...
    },
  },
})
```

3.  Restart your local frontend: `npm run dev -- --host`

Now, when you use the app locally, it will send API requests to your cloud-hosted backend!
