# GEMINI.md

## Project Overview

**ManausNotebookLM-baseline** is the "Automation Backend" for the Antigravity platform. It is a containerized Flask application that provides a unified API for controlling NotebookLM.

It is unique because it employs a **Hybrid Architecture**:
1.  **Selenium**: Used for "Connect Account" (VNC) and complex state management.
2.  **MCP**: Proxies requests to the `notebooklm-mcp` library for high-speed API operations.

## Architecture Map

```mermaid
graph TD
    User[Client / Frontend] -->|HTTP API| Flask[Flask App (main.py)]
    
    subgraph "ManausNotebookLM-baseline Container"
        Flask -->|Blueprint| NLM_BP[notebooklm.py]
        Flask -->|Blueprint| MCP_BP[mcp_bp.py]
        
        NLM_BP -->|WebDriver| Chrome[Headless Chrome]
        MCP_BP -->|Subprocess| Bridge[mcp_bridge.py]
        
        Chrome -->|VNC Tunnel| VNC[VNC Server :5900]
    end
    
    subgraph "External / Sibling"
        Bridge -->|Import| MCP_Lib[notebooklm-mcp Library]
    end
    
    MCP_Lib -->|HTTP/RPC| Google[NotebookLM.google.com]
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

### 2. Generate Artifact (MCP Bridge)
Uses the optimized `notebooklm-mcp` library for speed.

1.  **Request:** POST `/api/mcp/generate_artifact`
2.  **Bridge:** `mcp_bp.py` spawns `mcp_bridge.py` as a subprocess.
3.  **Load:** Bridge loads the `notebooklm-mcp` library from the sibling directory.
4.  **Execute:** Uses the `batchexecute` API (via `api_client.py` in sibling) to generate content.
5.  **Return:** JSON result returned to Flask and then to the client.

## Troubleshooting

### VNC / Display Issues
*   **Symptom:** Black screen or "Extensions" crash tab on VNC.
*   **Fix:** Ensure the container has `--shm-size=2g` or larger. Selenium needs shared memory.
*   **Restart:** `docker-compose down` and `docker-compose up -d --build`.

### Auth "No Cached Tokens"
*   **Symptom:** MCP endpoints return 401.
*   **Fix:** The MCP layer cannot see the cookies extracted by Selenium.
    1.  Run `.\connect_vnc.ps1`.
    2.  Check if you are logged in inside the VNC window.
    3.  If logged in, refresh the page to trigger the cookie capture logic in `notebooklm.py`.

### Sibling Import Errors
*   **Symptom:** `ModuleNotFoundError: No module named 'notebooklm_mcp'`
*   **Fix:** Ensure the `notebooklm-mcp` repository exists at `../notebooklm-mcp` relative to this folder. The Docker container mounts this directory to `/app/notebooklm-mcp`.
