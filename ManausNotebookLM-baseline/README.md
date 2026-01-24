# ManausNotebookLM-baseline (Antigravity Backend)

**The NotebookLM Automation Backend for Antigravity.**

This project serves as the central orchestration layer for the Antigravity platform. It exposes a Flask-based API that automates interactions with [NotebookLM](https://notebooklm.google.com) using a **Hybrid Architecture** that combines direct Selenium control with the high-performance `notebooklm-mcp` library.

## 🏗️ Architecture

This backend implements a dual-strategy approach to automation:

1.  **Direct Selenium Control (`notebooklm.py`)**:
    *   Used for complex, stateful interactions like the **"Connect Account"** flow.
    *   Handles VNC-based interactive login sessions.
    *   Manages the headless Chrome browser lifecycle.

2.  **MCP Bridge (`mcp_bp.py`)**:
    *   Proxies requests to the sibling **[notebooklm-mcp](../notebooklm-mcp)** library.
    *   Used for high-speed artifact generation (Audio, Infographics, Mind Maps).
    *   Leverages the reverse-engineered `batchexecute` API for performance.

## 🚀 Key Features

*   **Universal Auth**: Authenticate once via VNC; sessions are shared with the MCP layer.
*   **Artifact Factory**: Generate Briefing Docs, Podcasts, and Infographics programmatically.
*   **Supabase Integration**: Persists user data and generated artifact metadata.
*   **Self-Healing**: Automatically detects and refreshes expired sessions.

## 🛠️ Getting Started

### Prerequisites

*   **Docker & Docker Compose**: For running the containerized stack.
*   **Python 3.11+**: For local development.
*   **Sibling Repo**: The `notebooklm-mcp` directory must exist at `../notebooklm-mcp`.

### 1. Connection (Authentication)

Authentication is handled via a secure VNC tunnel to a headless Chrome instance running in Docker.

**Windows Quick Start:**

```powershell
.\connect_vnc.ps1
```

1.  Run the script to open the tunnel.
2.  Navigate to `http://localhost:7900` in your browser.
3.  Password: `secret`
4.  Log in to Google/NotebookLM inside the VNC window.
5.  **Success!** The backend automatically extracts your cookies and shares them with the MCP layer.

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

*   `app.py` / `main.py`: Flask entry point.
*   `notebooklm.py`: Selenium orchestration logic.
*   `mcp_bp.py`: Bridge to the `notebooklm-mcp` library.
*   `connect_vnc.ps1`: Script to establishing VNC auth sessions.
*   `Dockerfile`: Defines the automation environment.

## 📚 Documentation

*   **[GEMINI.md](GEMINI.md)**: Detailed architecture and workflows.
*   **[CLAUDE.md](CLAUDE.md)**: Developer guide and commands.
*   **[../notebooklm-mcp/README.md](../notebooklm-mcp/README.md)**: Documentation for the core MCP library.