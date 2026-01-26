# ManausNotebookLM-baseline (Antigravity Backend)

**The NotebookLM Automation Backend for Antigravity.**

This project serves as the central orchestration layer for the Antigravity platform. It exposes a Flask-based API that automates interactions with [NotebookLM](https://notebooklm.google.com) using a **Hybrid Architecture** that combines direct Selenium control with the high-performance `notebooklm-mcp` library.

## 🏗️ Architecture

This backend uses a **Sidecar Container Pattern** that separates concerns into specialized containers:

### App Container (`notebooklm-backend-app`)
*   **Role**: Flask API server and NLM CLI orchestration
*   **Components**: 
    *   Flask blueprints (`mcp_bp.py`, `notebooklm.py`, `user.py`)
    *   NLM CLI wrapper (`nlm_client.py`) for high-speed artifact generation
*   **Communication**: Connects to selenium sidecar via `http://selenium:4444/wd/hub`

### Selenium Sidecar Container (`notebooklm-backend-selenium`)
*   **Role**: Standalone Chrome environment
*   **Components**:
    *   Headless Chrome browser
    *   VNC server (port 7900) for interactive authentication
    *   Selenium Hub (port 4444)
*   **Persistence**: Mounts `./chrome-data` to preserve login state across restarts

### Dual-Strategy Automation

1.  **Direct Selenium Control** (via sidecar):
    *   Used for complex, stateful interactions like the **"Connect Account"** flow
    *   Handles VNC-based interactive login sessions
    *   Manages browser session state

2.  **NLM CLI Wrapper** (`nlm_client.py`):
    *   Wraps the `nlm` command-line tool from **[notebooklm-mcp-server](https://pypi.org/project/notebooklm-mcp-server/)**
    *   Used for high-speed artifact generation (Audio, Infographics, Mind Maps)
    *   Leverages the reverse-engineered `batchexecute` API for performance
    *   Installed in app container via pipx at `/home/appuser/.local/bin/nlm`

## 🚀 Key Features

*   **Universal Auth**: Authenticate once via VNC or NLM CLI; sessions are shared across layers.
*   **Artifact Factory**: Generate Briefing Docs, Podcasts, and Infographics programmatically.
*   **Supabase Integration**: Persists user data and generated artifact metadata.
*   **Self-Healing**: Automatically detects and refreshes expired sessions.

## 🛠️ Getting Started

### Prerequisites

*   **Docker & Docker Compose**: For running the containerized stack.
*   **Python 3.11+**: For local development.
*   **NLM CLI**: Install on host: `uv tool install notebooklm-mcp-server`

### 1. Connection (Authentication)

Authentication can be done via:
- **Interactive VNC**: Manual login via secure VNC tunnel to selenium sidecar container
- **NLM CLI**: Authenticate using `nlm login` on host machine

Both methods save credentials that are shared with both containers via Docker volume mounts:
- NLM auth: `${LOCALAPPDATA}/nlm/nlm` → `/home/appuser/.local/share/nlm:ro` (app container)
- Chrome profile: `./chrome-data` → `/data` (selenium container)

**Windows Quick Start (VNC):**

```powershell
.\connect_vnc.ps1
```

1.  Run the script to open the tunnel.
2.  Navigate to `http://localhost:7900` in your browser.
3.  Password: `secret`
4.  Log in to Google/NotebookLM inside the VNC window.
5.  **Success!** The backend automatically extracts your cookies.

**Alternative: NLM CLI Authentication:**

```powershell
# On host machine
uv tool install notebooklm-mcp-server
nlm login
```

This creates an auth profile at `~/.local/share/nlm/` that is automatically mounted into the Docker container.

### 2. Deployment

**Run Locally (Docker):**

```powershell
.\deploy_local.ps1
```

**Deploy to VM:**

```powershell
.\deploy_to_vm.ps1
```

## 📂 Project Structure

*   `main.py`: Flask application entry point, registers blueprints
*   `notebooklm.py`: Selenium orchestration blueprint (connects to sidecar)
*   `mcp_bp.py`: API blueprint for artifact generation via NLM CLI
*   `nlm_client.py`: Python wrapper around `nlm` CLI tool
*   `user.py`: User management blueprint
*   `connect_vnc.ps1`: Script for establishing VNC auth sessions
*   `Dockerfile`: App container (Flask + NLM CLI)
*   `Dockerfile.selenium`: Selenium sidecar container (Chrome + VNC)
*   `docker-compose.yml`: Multi-container orchestration

## 📚 Documentation

*   **[GEMINI.md](GEMINI.md)**: Detailed architecture and workflows.
*   **[CLAUDE.md](CLAUDE.md)**: Developer guide and commands.
*   **[../notebooklm-mcp/README.md](../notebooklm-mcp/README.md)**: Documentation for the core MCP library.