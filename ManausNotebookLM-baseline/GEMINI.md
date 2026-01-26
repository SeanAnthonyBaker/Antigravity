# GEMINI.md

## Project Overview

**ManausNotebookLM-baseline** is the "Automation Backend" for the Antigravity platform. It is a containerized Flask application that provides a unified API for controlling NotebookLM.

It employs a **Sidecar Container Architecture** that separates concerns:
1.  **App Container**: Flask API + NLM CLI orchestration (port 5000)
2.  **Selenium Sidecar**: Headless Chrome + VNC server (ports 4444, 7900, 5900)

The app container uses two automation strategies:
1.  **Selenium WebDriver**: Connects to sidecar for "Connect Account" (VNC) and complex state management
2.  **NLM CLI Wrapper**: Uses `nlm_client.py` to call the `nlm` command-line tool (from `notebooklm-mcp-server`) for high-speed artifact generation

## Architecture Map

```mermaid
graph TD
    User[Client / Frontend] -->|HTTP API| Flask[Flask App - main.py]
    
    subgraph "App Container (notebooklm-backend-app)"
        Flask -->|Blueprint| NLM_BP[notebooklm.py]
        Flask -->|Blueprint| MCP_BP[mcp_bp.py]
        Flask -->|Blueprint| USER_BP[user.py]
        
        MCP_BP -->|Import| Client[nlm_client.py]
        Client -->|Subprocess| CLI[nlm CLI Binary]
        CLI -->|Read Profile| AuthMount[/home/appuser/.local/share/nlm]
        
        NLM_BP -->|Remote WebDriver| SeleniumHub[http://selenium:4444/wd/hub]
    end
    
    subgraph "Selenium Sidecar Container (notebooklm-backend-selenium)"
        SeleniumHub[Selenium Hub :4444]
        Chrome[Headless Chrome]
        VNC[VNC Server :7900]
        
        SeleniumHub -->|Control| Chrome
        Chrome -->|Mirror| VNC
        Chrome -->|Persist| ChromeData[/data - Chrome Profile]
    end
    
    subgraph "Host Machine"
        HostAuth[~/.local/share/nlm]
        HostChromeData[./chrome-data]
        
        HostAuth -->|Volume Mount :ro| AuthMount
        HostChromeData -->|Volume Mount| ChromeData
    end
    
    CLI -->|HTTP/RPC| Google[NotebookLM.google.com]
    Chrome -->|HTTP| Google
    User -->|VNC Tunnel| VNC
```

## Key Workflows

### 1. "Connect Account" (Interactive VNC Auth)
Allows the user to log in manually via a secure, visual interface to the selenium sidecar.

1.  **Start:** Run `.\connect_vnc.ps1` on the host.
2.  **Tunnel:** Opens SSH tunnel forwarding local port 7900 to selenium container port 7900.
3.  **Interact:** User visits `http://localhost:7900` (Password: `secret`) and logs in.
4.  **Capture:** `notebooklm.py` (in app container) connects to selenium sidecar via WebDriver and can extract cookies.
5.  **Persist:** Cookies are saved to `./chrome-data` volume accessible to the selenium container.

### 2. Generate Artifact (NLM CLI)
Uses the `nlm` command-line tool for high-speed artifact generation.

1.  **Request:** POST `/api/mcp/generate_artifact` with `notebook_id`, `artifact_type`, and optional `prompt`
2.  **Import:** `mcp_bp.py` (in app container) imports `nlm_client.py` (CLI wrapper)
3.  **Authenticate:** NLM CLI reads credentials from host profile at `~/.local/share/nlm` (mounted into app container as Docker volume)
4.  **Execute:** `NLMClient` spawns subprocess calling `nlm` binary at `/home/appuser/.local/bin/nlm` (installed via pipx in Dockerfile)
5.  **Return:** JSON result with artifact URL returned to Flask and then to the client

## Troubleshooting

### VNC / Display Issues
*   **Symptom:** Black screen or "Extensions" crash tab on VNC.
*   **Fix:** Ensure the container has `--shm-size=2g` or larger. Selenium needs shared memory.
*   **Restart:** `docker-compose down` and `docker-compose up -d --build`.

### Auth "No Cached Tokens"
*   **Symptom:** MCP endpoints return 401 or "No cached tokens found".
*   **Fix:** The NLM CLI cannot find authentication profile.
    1.  Ensure NLM CLI is installed: `uv tool install notebooklm-mcp-server`
    2.  Authenticate via CLI: `nlm login` (or use VNC method and ensure auth profile is created)
    3.  Verify auth file exists: Check `~/.local/share/nlm/` for profile data
    4.  Restart Docker to ensure volume mount picks up new auth: `docker-compose restart app`

### NLM CLI Not Found
*   **Symptom:** `NLMClientError: Command 'nlm' not found` or subprocess errors
*   **Fix:** Install the NLM CLI tool on the **host machine** (not inside Docker):
    1.  `uv tool install notebooklm-mcp-server`
    2.  Verify installation: `nlm --version`
    3.  Authenticate: `nlm login`
    4.  Restart Docker: `docker-compose restart app`

### NLM Profile Not Mounted
*   **Symptom:** Docker container cannot access NLM authentication
*   **Fix:** Ensure `docker-compose.yml` has the correct volume mount:
    ```yaml
    volumes:
      - ${LOCALAPPDATA}/nlm/nlm:/home/appuser/.local/share/nlm:ro
    ```
    On Windows, this maps to `%LOCALAPPDATA%\nlm\nlm`. Verify the path exists on your host.
