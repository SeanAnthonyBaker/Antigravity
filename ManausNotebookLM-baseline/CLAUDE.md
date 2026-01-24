# CLAUDE.md

## Developer Commands

### Development
```powershell
# Run the complete stack (rebuilds app container)
.\deploy_local.ps1
```

### Automation / Auth
```powershell
# Open VNC tunnel for interactive login
.\connect_vnc.ps1
```

### Deployment
```powershell
# Deploy current code to the GCP VM
.\deploy_to_vm.ps1
```

## Code Style
- **Python**: Follow PEP 8 generally.
- **Flask**: Use Blueprints for modularity (`notebooklm.py`, `mcp_bp.py`).
- **Selenium**: Always use `wait.until` references; the DOM is dynamic.
- **Logging**: Use the centralized logger; avoid `print`.

## Key Files
- `notebooklm.py`: Core Selenium driver logic.
- `mcp_bp.py`: Flask blueprint that bridges to the `notebooklm-mcp` sibling library.
- `entrypoint.sh`: Startup script that initializes Xvfb (display) and VNC.
- `docker-compose.yml`: Defines the `app` and `selenium` services.
