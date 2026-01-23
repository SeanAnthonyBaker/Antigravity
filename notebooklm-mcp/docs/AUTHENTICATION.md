# Authentication Guide

This guide explains how to authenticate with NotebookLM MCP.

## Overview

NotebookLM MCP uses browser cookies for authentication (there is no official API). The `notebooklm-mcp-auth` CLI tool extracts these cookies and caches them for the MCP server to use.

**Two authentication methods are available:**

| Method | Best For | Requires |
|--------|----------|----------|
| **Auto Mode** (default) | Most users | Chrome installed, separate profile |
| **File Mode** (`--file`) | Complex setups, troubleshooting | Manual cookie extraction |

---

## Method 1: Auto Mode (Recommended)

This method launches Chrome automatically and extracts cookies after you log in.

### Prerequisites

- Google Chrome installed
- No other instance of the NotebookLM auth profile running

### Steps

```bash
# 1. (Optional) Close your main browser if you want, but NOT required.
#    Just ensure no other notebooklm-mcp-auth window is already open.

# 2. Run the auth command
notebooklm-mcp-auth

# 3. Log in to your Google account in the browser window that opens

# 4. Wait for "SUCCESS!" message
```

### What Happens Behind the Scenes

1. A dedicated Chrome profile is created at `~/.notebooklm-mcp/chrome-profile/`
2. Chrome launches with remote debugging enabled
3. You log in to NotebookLM via the browser
4. Cookies and CSRF token are extracted and cached
5. Chrome can be closed

### Persistent Login

The dedicated Chrome profile persists your Google login:
- **First run:** You must log in to Google
- **Future runs:** Already logged in, just extracts fresh cookies

This profile is separate from your regular Chrome profile and includes no extensions.

---

## Method 2: File Mode

This method lets you manually extract and provide cookies. Use this if:
- Auto mode doesn't work on your system
- You have Chrome extensions that interfere (e.g., Google Antigravity IDE)
- You prefer manual control

### Steps

```bash
# Option A: Interactive mode (shows instructions, prompts for file path)
notebooklm-mcp-auth --file

# Option B: Direct file path
notebooklm-mcp-auth --file /path/to/cookies.txt
```

### How to Extract Cookies Manually

1. Open Chrome and go to https://notebooklm.google.com
2. Make sure you're logged in
3. Press **F12** (or **Cmd+Option+I** on Mac) to open DevTools
4. Click the **Network** tab
5. In the filter box, type: `batchexecute`
6. Click on any notebook to trigger a request
7. Click on a `batchexecute` request in the list
8. In the right panel, scroll to **Request Headers**
9. Find the line starting with `cookie:`
10. Right-click the cookie **value** and select **Copy value**
11. Paste into a text file and save

### Cookie File Format

The cookie file should contain the raw cookie string from Chrome DevTools:

```
SID=abc123...; HSID=xyz789...; SSID=...; APISID=...; SAPISID=...; __Secure-1PSID=...; ...
```

**Notes:**
- Lines starting with `#` are treated as comments and ignored
- The file can contain the cookie string on one or multiple lines
- A template file `cookies.txt` is included in the repository

---

## Where Tokens Are Stored

Authentication tokens are cached at:

```
~/.notebooklm-mcp/auth.json
```

This file contains:
- Parsed cookies
- CSRF token (auto-extracted)
- Session ID (auto-extracted)
- Extraction timestamp

The dedicated Chrome profile (for auto mode) is stored at:

```
~/.notebooklm-mcp/chrome-profile/
```

---

## After Authentication

Once authenticated, add the MCP to your AI tool:

**Claude Code:**
```bash
claude mcp add notebooklm-mcp -- notebooklm-mcp
```

**Gemini CLI:**
```bash
gemini mcp add notebooklm notebooklm-mcp
```

**Manual (settings.json):**
```json
{
  "mcpServers": {
    "notebooklm-mcp": {
      "command": "notebooklm-mcp"
    }
  }
}
```

Then restart your AI assistant.

---

## Self-Healing Authentication

The NotebookLM MCP includes a **Self-Healing** mechanism. If the MCP server detects that your cookies have expired (e.g., API calls return 401/403), it will:

1. Attempt to run `notebooklm-mcp-auth --headless` in the background.
2. If your Google session in the dedicated profile is still active, it will automatically extract new cookies.
3. Your AI tool will continue working without you needing to manually re-authenticate.

If the session in the dedicated profile also expires, you will see an error message asking you to run `notebooklm-mcp-auth` manually to re-log in.

---

## Troubleshooting

### "Chrome is running but without remote debugging enabled"

Close Chrome completely and try again. On Mac, use **Cmd+Q** to fully quit.

### Auto mode fails to connect

Try file mode instead:
```bash
notebooklm-mcp-auth --file
```

### "401 Unauthorized" or "403 Forbidden" errors

Your cookies have expired. Run the auth command again to refresh.

### Chrome opens with strange branding (e.g., Antigravity IDE)

Some Chrome extensions or tools modify Chrome's behavior. Use file mode:
```bash
notebooklm-mcp-auth --file
```

### Cookie file shows "missing required cookies"

Make sure you copied the cookie **value**, not the header name. The value should start with something like `SID=...` not `cookie: SID=...`.

---

## Chrome 136+ Compatibility

Chrome version 136 and later restrict remote debugging on the default profile for security reasons. This MCP works around this by:

1. Using a dedicated profile directory (`~/.notebooklm-mcp/chrome-profile/`)
2. Adding the `--remote-allow-origins=*` flag for WebSocket connections

This is handled automatically - no action required from users.

---

## Security Notes

- Cookies are stored locally in `~/.notebooklm-mcp/auth.json`
- The dedicated Chrome profile contains your Google login for NotebookLM
- Never share your `auth.json` file or commit it to version control
- The `cookies.txt` file in the repo is a template - don't commit real cookies
