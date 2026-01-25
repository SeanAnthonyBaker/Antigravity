# GEMINI.md

## Project Overview

**ManausNotebookLM-baseline** is the "Automation Backend" for the Antigravity platform. It is a containerized Flask application that provides a unified API for controlling NotebookLM.

It is unique because it employs a **Hybrid Architecture**:
1.  **Selenium**: Used for "Connect Account" (VNC) and complex state management.
2.  **NLM CLI Wrapper**: Uses `nlm_client.py` to call the `nlm` command-line tool (from `notebooklm-mcp-server`) for high-speed artifact generation.

## Architecture Map

```mermaid
graph TD
    User[Client / Frontend] -->|HTTP API| Flask[Flask App (main.py)]
    
    subgraph "ManausNotebookLM-baseline Container"
        Flask -->|Blueprint| NLM_BP[notebooklm.py]
        Flask -->|Blueprint| MCP_BP[mcp_bp.py]
        
        NLM_BP -->|WebDriver| Chrome[Headless Chrome]
        MCP_BP -->|Import| Client[nlm_client.py]
        
        Client -->|Subprocess| CLI[nlm CLI Command]
        Chrome -->|VNC Tunnel| VNC[VNC Server :5900]
    end
    
    subgraph "Host Machine"
        CLI -->|Read Profile| Auth[~/.local/share/nlm]
        Auth -->|Mounted Volume| Container[Docker Volume]
    end
    
    CLI -->|HTTP/RPC| Google[NotebookLM.google.com]
    Chrome -->|HTTP| Google
```

## Key Workflows

### 1. "Connect Account" (Interactive VNC Auth)
Allows the user to log in manually via a secure, visual interface.

1.  **Start:** Run `.\connect_vnc.ps1` on the host.
2.  **Tunnel:** Opens SSH tunnel forwarding local port 7900 to container port 7900.
3.  **Interact:** User visits `http://localhost:7900` (Password: `secret`) and logs in.
4.  **Capture:** `notebooklm.py` detects the login and extracts cookies.
5.  **Share:** Cookies are saved to a shared volume/path accessible by the MCP layer.

### 2. Generate Artifact (NLM CLI)
Uses the `nlm` command-line tool for high-speed artifact generation.

1.  **Request:** POST `/api/mcp/generate_artifact` with `notebook_id`, `artifact_type`, and optional `prompt`
2.  **Import:** `mcp_bp.py` imports `nlm_client.py` (CLI wrapper)
3.  **Authenticate:** NLM CLI reads credentials from host profile at `~/.local/share/nlm` (mounted as Docker volume)
4.  **Execute:** `NLMClient` spawns subprocess calling `nlm` CLI commands (e.g., `nlm notebook create-audio`, `nlm notebook create-infographic`)
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
