# GEMINI.md

## Project Overview

**NotebookLM MCP Server**

This project implements a Model Context Protocol (MCP) server that provides programmatic access to [NotebookLM](https://notebooklm.google.com). It allows AI agents and developers to interact with NotebookLM notebooks, sources, and query capabilities.

Tested with personal/free tier accounts. May work with Google Workspace accounts but has not been tested. This project relies on reverse-engineered internal APIs (`batchexecute` RPCs).

## Environment & Setup

The project uses `uv` for dependency management and tool installation.

### Prerequisites
- Python 3.11+
- `uv` (Universal Python Package Manager)
- Google Chrome (for automated authentication)

### Installation

**From PyPI (Recommended):**
```bash
uv tool install notebooklm-mcp-server
# or: pip install notebooklm-mcp-server
```

**From Source (Development):**
```bash
git clone https://github.com/YOUR_USERNAME/notebooklm-mcp.git
cd notebooklm-mcp
uv tool install .
```

## Authentication (Simplified & Self-Healing)

**You only need to extract cookies** - the CSRF token and session ID are auto-extracted when the MCP starts.

**Option 1: Chrome DevTools MCP (Recommended for Assistants)**
If your AI assistant has Chrome DevTools MCP:
1. Navigate to `notebooklm.google.com`
2. Get cookies from any network request (e.g., `batchexecute`)
3. Call `save_auth_tokens(cookies=<cookie_header>, request_body=<request_body>, request_url=<request_url>)`

**Option 2: Auth CLI (Self-contained Auto Mode)**
Run `notebooklm-mcp-auth`. It launches a dedicated Chrome profile. Log in once, and your session is saved. This works alongside your main browser.

**Option 3: Manual (Environment Variables)**
Extract the `Cookie` header from Chrome DevTools:
```bash
export NOTEBOOKLM_COOKIES="SID=xxx; HSID=xxx; SSID=xxx; ..."
```

> **Self-Healing:** If the MCP detects expired cookies, it will attempt to refresh them automatically in the background using `notebooklm-mcp-auth --headless`.

Cookies last for weeks. When they expire completely, re-authenticate via the CLI.

## Development Workflow

### Building and Running

**Reinstalling after changes:**
Because `uv tool install` installs into an isolated environment, you must reinstall to see changes during development.
```bash
uv cache clean
uv tool install --force .
```

**Running the Server:**
```bash
notebooklm-mcp
```

### Testing

Run the test suite using `pytest` via `uv`:
```bash
# Run all tests
uv run pytest

# Run a specific test file
uv run pytest tests/test_api_client.py
```

## Project Structure

- `src/notebooklm_mcp/`
    - `server.py`: Main entry point. Defines the MCP server and tools.
    - `api_client.py`: The core logic. Contains the reverse-engineered API calls.
    - `auth.py`: Handles token validation, storage, and loading.
    - `auth_cli.py`: Implementation of the `notebooklm-mcp-auth` CLI.
- `CLAUDE.md`: Contains detailed documentation on the reverse-engineered RPC IDs and protocol specifics. **Refer to this file for API deep dives.**
- `pyproject.toml`: Project configuration and dependencies.

## Key Conventions

- **Reverse Engineering:** This project relies on undocumented APIs. Changes to Google's internal API will break functionality.
- **RPC Protocol:** The API uses Google's `batchexecute` protocol. Responses often contain "anti-XSSI" prefixes (`)]}'`) that must be stripped.
- **Tools:** New features should be exposed as MCP tools in `server.py`.
