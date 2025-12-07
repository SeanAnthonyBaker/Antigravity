#!/bin/bash
set -e

# Path to the read-only gcloud credentials mounted from the host
GCLOUD_RO_CREDS_DIR="/gcloud_creds_ro"
GCLOUD_WRITABLE_CONFIG_DIR="/home/seluser/.config/gcloud"

# The directory where the Chrome profile is stored inside the container.
PROFILE_DIR="/data"

echo "Custom Selenium Entrypoint: Setting up..."

# Fix ownership of the /data directory.
# Since /data is a mounted volume, it might be owned by root initially.
# We use sudo (passwordless for seluser) to fix this.
echo "Fixing ownership of $PROFILE_DIR..."
sudo chown -R seluser:seluser "$PROFILE_DIR"

echo "Setting up Google Cloud credentials..."

# First, check that the gcloud credentials directory was mounted successfully from the host.
if [ ! -f "$GCLOUD_RO_CREDS_DIR/application_default_credentials.json" ]; then
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "WARNING: Google Cloud ADC file not found in the container at '$GCLOUD_RO_CREDS_DIR'."
  echo "The browser will likely be redirected to a login page."
  echo "Please check the following on your host machine:"
  echo "1. Run 'gcloud auth application-default login' in your local terminal."
  echo "2. Create a '.gcloud' directory in your project root."
  echo "3. Copy the 'application_default_credentials.json' file from your system's gcloud config folder"
  echo "   (e.g., '~/.config/gcloud/' on Linux/Mac or '%APPDATA%\\gcloud' on Windows)"
  echo "   into your project's '.gcloud' directory."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
else
  # gcloud and ADC need a writable config directory. We copy the read-only credentials
  # from the host mount to a writable location inside the container.
  echo "Found credentials. Setting up writable gcloud config directory..."
  mkdir -p "$GCLOUD_WRITABLE_CONFIG_DIR"
  # Use sudo to copy because source might be root-owned (bind mount)
  sudo cp -rL "$GCLOUD_RO_CREDS_DIR/." "$GCLOUD_WRITABLE_CONFIG_DIR/"
  sudo chown -R seluser:seluser "$GCLOUD_WRITABLE_CONFIG_DIR"
  echo "Credentials copied to $GCLOUD_WRITABLE_CONFIG_DIR."
fi

# --- Download Chrome Profile from GCS if path is provided ---
if [ -n "$CHROME_PROFILE_GCS_PATH" ]; then
    echo "CHROME_PROFILE_GCS_PATH is set. Attempting to download profile from GCS..."
    # Ensure the target directory is empty before unzipping
    # This prevents merging old and new profiles, which can cause issues.
    if [ -d "$PROFILE_DIR" ] && [ "$(ls -A $PROFILE_DIR)" ]; then
        echo "Clearing existing profile data in $PROFILE_DIR..."
        rm -rf "$PROFILE_DIR"/*
    fi
    mkdir -p "$PROFILE_DIR"
    echo "Downloading profile from $CHROME_PROFILE_GCS_PATH to /tmp/profile.zip..."
    gcloud storage cp "$CHROME_PROFILE_GCS_PATH" /tmp/profile.zip
    echo "Unzipping profile to $PROFILE_DIR..."
    unzip -o /tmp/profile.zip -d "$PROFILE_DIR"
    rm /tmp/profile.zip
    echo "Profile successfully downloaded and extracted."
fi

# Clean up stale Chrome lock files from the profile directory.
# This prevents "user data directory is already in use" errors after an unclean shutdown.
echo "Checking for and removing stale Chrome lock files from profile directory: $PROFILE_DIR"
rm -f "$PROFILE_DIR/SingletonLock"
rm -f "$PROFILE_DIR/SingletonCookie"
rm -f "$PROFILE_DIR/SingletonSocket"
echo "Stale lock files removed."


echo "Starting original Selenium entrypoint..."
# We are already seluser, so just exec the script.
exec /opt/bin/entry_point.sh