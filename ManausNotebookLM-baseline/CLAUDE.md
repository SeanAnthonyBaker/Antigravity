# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ManausNotebookLM-baseline** - The automation backend for the Antigravity platform. Provides a Flask-based API that automates interactions with NotebookLM using a **Sidecar Container Architecture**:

1. **App Container** (`notebooklm-backend-app`): Flask API + NLM CLI orchestration
2. **Selenium Sidecar** (`notebooklm-backend-selenium`): Headless Chrome + VNC server

The app container uses two automation strategies:
1. **Selenium WebDriver** (`notebooklm.py`): Connects to sidecar for VNC-based interactive authentication and complex browser automation
2. **NLM CLI Wrapper** (`nlm_client.py`): For high-speed artifact generation via the `nlm` command-line tool

## Development Commands

```bash
# Start Docker containers locally
docker-compose up -d

# View logs
docker-compose logs -f app

# Restart after code changes
docker-compose restart app

# Rebuild containers
docker-compose up -d --build

# Stop all services
docker-compose down
```

## Prerequisites

**On Host Machine:**
- Docker & Docker Compose
- Python 3.11+
- NLM CLI: `uv tool install notebooklm-mcp-server`

## Authentication

Two methods available:

### Method 1: VNC Interactive Login (Recommended for first-time setup)

```powershell
.\connect_vnc.ps1
```

1. Opens SSH tunnel to VNC server
2. Visit `http://localhost:7900` (password: `secret`)
3. Log in to Google/NotebookLM
4. Cookies auto-extracted by `notebooklm.py`

### Method 2: NLM CLI (Recommended for automation)

```powershell
# On host machine
uv tool install notebooklm-mcp-server
nlm login
```

Creates auth profile at `~/.local/share/nlm/` which is auto-mounted into Docker container.

## Architecture

```
Frontend → Flask API (main.py) [App Container]
  ├─→ notebooklm_bp (notebooklm.py) → Selenium Hub → Chrome [Selenium Sidecar]
  ├─→ mcp_bp (mcp_bp.py) → nlm_client.py → nlm CLI → NotebookLM API
  └─→ user_bp (user.py) → User Management
```

### Sidecar Pattern

**App Container** (`notebooklm-backend-app`):
- Flask application and blueprints
- NLM CLI orchestration via `nlm_client.py`
- Connects to selenium sidecar via `http://selenium:4444/wd/hub`

**Selenium Sidecar** (`notebooklm-backend-selenium`):
- Standalone Chrome environment
- VNC server on port 7900
- Selenium Hub on port 4444
- Persists Chrome profile in `./chrome-data`

### Key Files

- **main.py**: Flask application entry point, registers blueprints
- **notebooklm.py**: Selenium-based browser automation, VNC auth capture
- **mcp_bp.py**: API blueprint for artifact generation endpoints
- **nlm_client.py**: Python wrapper around `nlm` CLI commands
- **user.py**: User management blueprint
- **docker-compose.yml**: Multi-container orchestration (app, selenium, caddy)

## API Endpoints

### MCP Blueprint (`/api/mcp/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/notebooks` | GET | List all notebooks via NLM CLI |
| `/health` | GET | Check NLM CLI connectivity and auth |
| `/generate_artifact` | POST | Generate artifacts (audio, video, infographic, etc.) |
| `/status/<notebook_id>` | GET | Poll artifact generation status |
| `/update_cookies` | POST | Verify/refresh authentication |
| `/proxy_artifact` | GET | Proxy artifact URLs to bypass CORS |

### NotebookLM Blueprint (`/api/`)

Selenium-based endpoints for complex workflows not yet supported by CLI.

## Docker Architecture

### Services

1. **app** (`notebooklm-backend-app`): Flask backend (port 5000)
   - Mounts: `../notebooklm-mcp` (reference), NLM auth directory
   - Depends on: selenium sidecar
   - Connects to: `http://selenium:4444/wd/hub`

2. **selenium** (`notebooklm-backend-selenium`): Headless Chrome + VNC
   - Ports: 4444 (Selenium Hub), 7900 (VNC Web), 5900 (VNC)
   - Mounts: Chrome profile data (`./chrome-data`), gcloud credentials
   - Provides: VNC interface for manual login

3. **caddy**: Reverse proxy (ports 80, 443)
   - Terminates SSL, routes to backend
   - Only needed for production deployments

### Critical Volume Mounts

```yaml
# App Container
- ../notebooklm-mcp:/notebooklm-mcp:ro          # MCP library reference
- ${LOCALAPPDATA}/nlm/nlm:/home/appuser/.local/share/nlm:ro  # NLM CLI auth

# Selenium Container
- ./chrome-data:/data                           # Chrome profile persistence
- ./.gcloud:/gcloud_creds_ro:ro                # GCloud credentials (optional)
```

## Artifact Generation Flow

1. Frontend POSTs to `/api/mcp/generate_artifact` with:
   - `notebook_id`
   - `artifact_type` (audio, video, infographic, etc.)
   - `prompt` (optional)

2. `mcp_bp.py` imports `nlm_client.py`:
   ```python
   from nlm_client import NLMClient
   client = NLMClient(profile="default")
   ```

3. `nlm_client.py` spawns subprocess:
   ```bash
   nlm notebook create-audio --notebook-id <id> --json
   ```

4. CLI reads auth from `~/.local/share/nlm/default/auth.json`

5. Returns JSON with artifact metadata

## Troubleshooting

### "No cached tokens found"
- Ensure NLM CLI installed: `uv tool install notebooklm-mcp-server`
- Authenticate: `nlm login`
- Verify auth file: `ls ~/.local/share/nlm/default/`
- Restart Docker: `docker-compose restart app`

### "Command 'nlm' not found"
- Install on **host** (not in Docker): `uv tool install notebooklm-mcp-server`
- Verify: `nlm --version`
- Check PATH includes uv tools directory

### VNC shows black screen
- Increase shared memory: `shm_size: '2g'` in docker-compose.yml
- Check Selenium health: `docker-compose logs selenium`

### Auth profile not mounted
- Verify volume mount in docker-compose.yml
- On Windows: `${LOCALAPPDATA}/nlm/nlm` → `C:\Users\<user>\AppData\Local\nlm\nlm`
- Check directory exists: `ls $env:LOCALAPPDATA\nlm\nlm`

## Deployment

### Local Development
```powershell
.\deploy_local.ps1
```

### VM Deployment
```powershell
.\deploy_to_vm.ps1
```

See `/deploy_selenium_backend` workflow for cloud deployment details.

## Adding New Features

When adding new artifact types or endpoints:

1. Check if `nlm` CLI supports it: `nlm --help`
2. Add method to `nlm_client.py` wrapping the CLI command
3. Add endpoint to `mcp_bp.py` calling the new method
4. Update frontend to call the new endpoint
5. Test with `docker-compose restart app`

## Testing

```bash
# Test NLM CLI directly
nlm notebook list --json

# Test health endpoint
curl http://localhost:5000/api/mcp/health

# Test artifact generation
curl -X POST http://localhost:5000/api/mcp/generate_artifact \
  -H "Content-Type: application/json" \
  -d '{"notebook_id":"abc123","artifact_type":"audio"}'
```

## Documentation

- **GEMINI.md**: Architecture overview and key workflows
- **README.md**: User-facing setup and deployment guide
- **This file (CLAUDE.md)**: Developer guide and reference
