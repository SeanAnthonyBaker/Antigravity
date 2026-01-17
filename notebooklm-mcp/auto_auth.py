#!/usr/bin/env python3
"""
NotebookLM Auto-Authentication Helper

This script:
1. Launches Chrome in debug mode
2. Opens NotebookLM login page
3. Waits for you to log in
4. Automatically extracts and saves the cookies

Requirements: pip install websocket-client requests
"""

import subprocess
import time
import json
import sys
import os
import shutil
from pathlib import Path

try:
    import requests
    import websocket
except ImportError:
    print("Missing dependencies. Installing...")
    subprocess.run([sys.executable, "-m", "pip", "install", "websocket-client", "requests"], check=True)
    import requests
    import websocket


# Configuration
CHROME_DEBUG_PORT = 9222
NOTEBOOKLM_URL = "https://notebooklm.google.com/"
COOKIES_FILE = Path(__file__).parent / "cookies.txt"
CHROME_PROFILE_DIR = Path(__file__).parent / ".chrome-auth-profile"

# Common Chrome paths on Windows
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
]


def find_chrome() -> str | None:
    """Find Chrome executable on the system."""
    for path in CHROME_PATHS:
        if os.path.exists(path):
            return path
    
    # Try 'where' command on Windows
    try:
        result = subprocess.run(["where", "chrome"], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip().split("\n")[0]
    except:
        pass
    
    return None


def launch_chrome_debug(chrome_path: str) -> subprocess.Popen:
    """Launch Chrome with remote debugging enabled."""
    # Create profile directory if it doesn't exist
    CHROME_PROFILE_DIR.mkdir(exist_ok=True)
    
    args = [
        chrome_path,
        f"--remote-debugging-port={CHROME_DEBUG_PORT}",
        f"--user-data-dir={CHROME_PROFILE_DIR}",
        "--no-first-run",
        "--no-default-browser-check",
        NOTEBOOKLM_URL,
    ]
    
    print(f"Launching Chrome with debugging on port {CHROME_DEBUG_PORT}...")
    return subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def wait_for_chrome_debug() -> bool:
    """Wait for Chrome DevTools to be available."""
    url = f"http://localhost:{CHROME_DEBUG_PORT}/json"
    
    for _ in range(30):  # Wait up to 30 seconds
        try:
            response = requests.get(url, timeout=1)
            if response.status_code == 200:
                return True
        except:
            pass
        time.sleep(1)
    
    return False


def get_debugger_url() -> str | None:
    """Get the WebSocket debugger URL for the NotebookLM tab."""
    url = f"http://localhost:{CHROME_DEBUG_PORT}/json"
    
    try:
        response = requests.get(url, timeout=5)
        tabs = response.json()
        
        for tab in tabs:
            if "notebooklm.google.com" in tab.get("url", ""):
                return tab.get("webSocketDebuggerUrl")
        
        # If no NotebookLM tab, return the first tab
        if tabs:
            return tabs[0].get("webSocketDebuggerUrl")
    except Exception as e:
        print(f"Error getting debugger URL: {e}")
    
    return None


def get_cookies_via_cdp(ws_url: str) -> list[dict]:
    """Extract cookies using Chrome DevTools Protocol."""
    ws = websocket.create_connection(ws_url)
    
    # Request cookies for NotebookLM domain
    request = {
        "id": 1,
        "method": "Network.getCookies",
        "params": {
            "urls": [
                "https://notebooklm.google.com",
                "https://accounts.google.com",
                "https://www.google.com",
            ]
        }
    }
    
    ws.send(json.dumps(request))
    response = json.loads(ws.recv())
    ws.close()
    
    if "result" in response and "cookies" in response["result"]:
        return response["result"]["cookies"]
    
    return []


def format_cookies_for_header(cookies: list[dict]) -> str:
    """Format cookies into a Cookie header string."""
    # Filter to essential cookies and format as KEY=VALUE; KEY=VALUE; ...
    cookie_parts = []
    for cookie in cookies:
        name = cookie.get("name", "")
        value = cookie.get("value", "")
        if name and value:
            cookie_parts.append(f"{name}={value}")
    
    return "; ".join(cookie_parts)


def check_if_logged_in(cookies: list[dict]) -> bool:
    """Check if the cookies indicate a logged-in session."""
    cookie_names = {c.get("name") for c in cookies}
    
    # These cookies are present when logged in to Google
    required = {"SID", "HSID", "SSID", "APISID", "SAPISID"}
    return required.issubset(cookie_names)


def save_cookies(cookie_header: str):
    """Save cookies to file."""
    with open(COOKIES_FILE, "w", encoding="utf-8") as f:
        f.write(cookie_header)
    print(f"\n✅ Cookies saved to: {COOKIES_FILE}")


def main():
    print("=" * 60)
    print("NotebookLM Auto-Authentication Helper")
    print("=" * 60)
    print()
    
    # Find Chrome
    chrome_path = find_chrome()
    if not chrome_path:
        print("❌ Chrome not found. Please install Google Chrome or add it to PATH.")
        sys.exit(1)
    
    print(f"Found Chrome: {chrome_path}")
    
    # Check if Chrome debug is already running
    try:
        response = requests.get(f"http://localhost:{CHROME_DEBUG_PORT}/json", timeout=1)
        if response.status_code == 200:
            print(f"Chrome debug already running on port {CHROME_DEBUG_PORT}")
            chrome_process = None
    except:
        # Launch Chrome
        chrome_process = launch_chrome_debug(chrome_path)
    
    # Wait for Chrome to be ready
    print("Waiting for Chrome to start...")
    if not wait_for_chrome_debug():
        print("❌ Chrome debug server did not start. Please try again.")
        sys.exit(1)
    
    print()
    print("=" * 60)
    print("🔐 PLEASE LOG IN TO YOUR GOOGLE ACCOUNT IN THE CHROME WINDOW")
    print("=" * 60)
    print()
    print("Once you see the NotebookLM home page (with your notebooks),")
    print("press ENTER here to extract the cookies...")
    print()
    
    # Wait for user to press Enter
    input(">>> Press ENTER when logged in... ")
    
    # Get debugger URL
    ws_url = get_debugger_url()
    if not ws_url:
        print("❌ Could not connect to Chrome. Is the NotebookLM tab open?")
        sys.exit(1)
    
    print("Extracting cookies...")
    
    # Extract cookies
    cookies = get_cookies_via_cdp(ws_url)
    
    if not cookies:
        print("❌ No cookies found. Please make sure you're logged in.")
        sys.exit(1)
    
    print(f"Found {len(cookies)} cookies.")
    
    # Check if logged in
    if not check_if_logged_in(cookies):
        print("⚠️  Warning: Essential cookies not found. You may not be fully logged in.")
        print("   Please log in to NotebookLM and try again.")
        response = input("   Continue anyway? (y/n): ")
        if response.lower() != "y":
            sys.exit(1)
    
    # Format and save
    cookie_header = format_cookies_for_header(cookies)
    save_cookies(cookie_header)
    
    print()
    print("=" * 60)
    print("✅ SUCCESS! Authentication cookies saved.")
    print("=" * 60)
    print()
    print("You can now close the Chrome window.")
    print("Your NotebookLM MCP should now work with the new cookies.")
    print()
    
    # Optionally close Chrome
    if chrome_process:
        response = input("Close the debug Chrome window? (y/n): ")
        if response.lower() == "y":
            chrome_process.terminate()
            print("Chrome closed.")
            
            # Optionally clean up profile
            response = input("Delete the temporary Chrome profile? (y/n): ")
            if response.lower() == "y":
                try:
                    shutil.rmtree(CHROME_PROFILE_DIR)
                    print("Profile deleted.")
                except:
                    print("Could not delete profile (may be in use).")


if __name__ == "__main__":
    main()
