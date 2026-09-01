#!/usr/bin/env bash
# ==============================================================================
# MeshCentral + Nginx Reverse Proxy Automated Setup Script
# ==============================================================================
# Usage:
#   chmod +x deploy_meshcentral_nginx.sh
#   sudo ./deploy_meshcentral_nginx.sh <DOMAIN_NAME> <EMAIL>
# Example:
#   sudo ./deploy_meshcentral_nginx.sh mesh.example.com admin@example.com
# ==============================================================================

set -euo pipefail

if [ "$#" -ne 2 ]; then
    echo "Error: Missing arguments."
    echo "Usage: sudo $0 <DOMAIN_NAME> <EMAIL>"
    echo "Example: sudo $0 mesh.mydomain.com admin@mydomain.com"
    exit 1
fi

DOMAIN="$1"
EMAIL="$2"
MESHCENTRAL_DIR="/opt/meshcentral"
MESHCENTRAL_DATA_DIR="$MESHCENTRAL_DIR/meshcentral-data"

echo "=========================================================="
echo "Starting MeshCentral + Nginx Deployment for: $DOMAIN"
echo "=========================================================="

# 1. Update system & Install Dependencies
echo "[1/6] Installing Node.js, Nginx, and Certbot..."
apt-get update -y
apt-get install -y curl gnupg2 ca-certificates lsb-release debian-archive-keyring nginx certbot python3-certbot-nginx

# Install Node.js 20.x if not already installed
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 18 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 2. Setup MeshCentral Directory & Install
echo "[2/6] Setting up MeshCentral..."
mkdir -p "$MESHCENTRAL_DATA_DIR"
cd "$MESHCENTRAL_DIR"

if [ ! -f "package.json" ]; then
    npm init -y
fi
npm install meshcentral

# 3. Create MeshCentral Configuration (Behind Reverse Proxy)
echo "[3/6] Configuring MeshCentral (port 4430 with TlsOffload)..."
cat <<EOF > "$MESHCENTRAL_DATA_DIR/config.json"
{
  "\$schema": "http://info.meshcentral.com/downloads/meshcentral-config-schema.json",
  "settings": {
    "Cert": "$DOMAIN",
    "WANonly": true,
    "Port": 4430,
    "AliasPort": 443,
    "TlsOffload": true,
    "TrustedProxy": "127.0.0.1"
  },
  "domains": {
    "": {
      "Title": "MeshCentral Remote Access",
      "CertUrl": "https://$DOMAIN:443/"
    }
  }
}
EOF

# 4. Configure systemd service for MeshCentral
echo "[4/6] Setting up MeshCentral systemd service..."
cat <<EOF > /etc/systemd/system/meshcentral.service
[Unit]
Description=MeshCentral Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$MESHCENTRAL_DIR
ExecStart=$(which node) $MESHCENTRAL_DIR/node_modules/meshcentral
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable meshcentral
systemctl restart meshcentral

# 5. Configure Nginx Reverse Proxy with WebSocket support
echo "[5/6] Configuring Nginx reverse proxy..."
cat <<EOF > /etc/nginx/sites-available/meshcentral.conf
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    # SSL certificates will be managed by certbot
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Allow large file uploads for MeshCentral file transfers
    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:4430;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;

        # Forwarded headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;

        # Persistent connection timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

# Temporarily enable HTTP-only config for certbot if certificates don't exist yet
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "[Certbot] Obtaining Let's Encrypt certificate for $DOMAIN..."
    cat <<EOF > /etc/nginx/sites-available/meshcentral.conf
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:4430;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/meshcentral.conf /etc/nginx/sites-enabled/meshcentral.conf
    rm -f /etc/nginx/sites-enabled/default
    systemctl restart nginx

    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

    # Re-apply full WebSocket and SSL Nginx config
    cat <<EOF > /etc/nginx/sites-available/meshcentral.conf
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:4430;
        proxy_http_version 1.1;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF
fi

ln -sf /etc/nginx/sites-available/meshcentral.conf /etc/nginx/sites-enabled/meshcentral.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "=========================================================="
echo "✅ MeshCentral + Nginx deployment complete!"
echo "👉 Open https://$DOMAIN in your web browser."
echo "👉 Create your initial Admin account."
echo "👉 Go to 'My Devices' -> 'Add Agent' to install on your PC."
echo "=========================================================="
