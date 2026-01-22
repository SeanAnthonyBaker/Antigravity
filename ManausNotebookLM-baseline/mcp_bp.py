import os
import json
import logging
import subprocess
import requests
import httpx
import time
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from flask import Blueprint, request, jsonify, Response, stream_with_context

mcp_bp = Blueprint('mcp_bp', __name__)
logger = logging.getLogger(__name__)

# Configuration - adjust paths as needed
# Using absolute paths to ensure robustness
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MCP_DIR = os.path.join(BASE_DIR, 'notebooklm-mcp')

# Deterministic check for environment
if os.name == 'nt': # Windows
    MCP_VENV_PYTHON = os.path.join(MCP_DIR, '.venv', 'Scripts', 'python.exe')
else: # Linux/Docker
    MCP_VENV_PYTHON = os.path.join(MCP_DIR, '.venv', 'bin', 'python')

# Fallback to system python if venv doesn't exist (useful for Docker if installed globally)
if not os.path.exists(MCP_VENV_PYTHON):
    import shutil
    MCP_VENV_PYTHON = shutil.which('python3') or shutil.which('python')

MCP_BRIDGE_SCRIPT = os.path.join(MCP_DIR, 'mcp_bridge.py')

def run_bridge_command(command_payload):
    """Executes the bridge script with the given JSON payload."""
    try:
        if not os.path.exists(MCP_VENV_PYTHON):
            return {"status": "error", "error": f"MCP Python interpreter not found at {MCP_VENV_PYTHON}"}
        
        if not os.path.exists(MCP_BRIDGE_SCRIPT):
            return {"status": "error", "error": f"Bridge script not found at {MCP_BRIDGE_SCRIPT}"}

        # Ensure the subprocess uses the local src/ for the package, not the installed one
        env = os.environ.copy()
        src_path = os.path.join(MCP_DIR, 'src')
        if src_path not in env.get('PYTHONPATH', ''):
            env['PYTHONPATH'] = f"{src_path}{os.pathsep}{env.get('PYTHONPATH', '')}"

        # Run the subprocess
        process = subprocess.Popen(
            [MCP_VENV_PYTHON, MCP_BRIDGE_SCRIPT, '--json-input'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=MCP_DIR, # Important to set CWD so imports work if needed
            env=env
        )
        
        stdout, stderr = process.communicate(input=json.dumps(command_payload))
        
        if process.returncode != 0:
            logger.error(f"Bridge script failed with return code {process.returncode}")
            logger.error(f"Stderr: {stderr}")
            return {"status": "error", "error": f"Bridge script execution failed: {stderr}"}
            
        try:
            return json.loads(stdout)
        except json.JSONDecodeError:
            logger.error("Failed to decode JSON output from bridge script")
            logger.error(f"Stdout: {stdout}")
            return {"status": "error", "error": "Invalid JSON output from bridge script", "raw_output": stdout}

    except Exception as e:
        logger.exception("Error running bridge command")
        return {"status": "error", "error": str(e)}

@mcp_bp.route('/notebooks', methods=['GET'])
def list_notebooks():
    """Fetches the list of notebooks from the MCP server."""
    logger.info("Fetching notebooks via MCP bridge...")
    
    payload = {"command": "list"}
    result = run_bridge_command(payload)
    
    if result.get("status") == "success":
        return jsonify(result)
    else:
        logger.error(f"MCP list_notebooks failed: {result}")
        return jsonify(result), 500

@mcp_bp.route('/health', methods=['GET'])
def health_check():
    """Verifies that the MCP server is accessible and authenticated."""
    logger.info("Performing MCP health check...")
    try:
        # Try to list notebooks (basic connectivity + auth test)
        payload = {"command": "list"}
        result = run_bridge_command(payload)
        
        if result.get("status") == "success":
            return jsonify({
                "status": "success",
                "message": "NotebookLM MCP is up and running",
                "notebook_count": len(result.get("notebooks", []))
            })
        else:
            return jsonify({
                "status": "error",
                "message": "MCP is reachable but authentication failed",
                "details": result.get("error")
            }), 401
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "MCP health check failed",
            "error": str(e)
        }), 500

@mcp_bp.route('/create', methods=['POST'])
def create_artifact():
    """Triggers artifact creation via MCP bridge."""
    data = request.get_json()
    if not data or 'notebook_id' not in data or 'artifact_type' not in data:
        return jsonify({"status": "error", "error": "Missing notebook_id or artifact_type"}), 400
        
    logger.info(f"Creating {data['artifact_type']} for notebook {data['notebook_id']} via MCP bridge")
    
    payload = {
        "command": "create",
        **data
    }
    result = run_bridge_command(payload)
    
    if result.get("status") == "success":
        return jsonify(result)
    else:
        logger.error(f"MCP create_artifact failed: {result}")
        return jsonify(result), 500

@mcp_bp.route('/status/<notebook_id>', methods=['GET'])
def get_status(notebook_id):
    """Checks the status of artifacts for a notebook."""
    payload = {"command": "status", "notebook_id": notebook_id}
    result = run_bridge_command(payload)
    
    if result.get("status") == "success":
        return jsonify(result)
    else:
        logger.error(f"MCP get_status failed: {result}")
        return jsonify(result), 500

@mcp_bp.route('/update_cookies', methods=['POST'])
def update_cookies():
    """Updates the internal cookies for NotebookLM."""
    logger.info("Triggering cookie update via auth_cli...")
    
    try:
        # Run headless refresh to get fresh tokens
        # Ensure it has the right PYTHONPATH
        env = os.environ.copy()
        src_path = os.path.join(MCP_DIR, 'src')
        if src_path not in env.get('PYTHONPATH', ''):
            env['PYTHONPATH'] = f"{src_path}{os.pathsep}{env.get('PYTHONPATH', '')}"

        process = subprocess.Popen(
            [MCP_VENV_PYTHON, "-m", "notebooklm_mcp.auth_cli", "--headless"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=MCP_DIR,
            env=env
        )
        
        stdout, stderr = process.communicate(timeout=120)
        
        if process.returncode != 0:
            logger.error(f"Cookie update failed with return code {process.returncode}")
            logger.error(f"Stdout: {stdout}")
            logger.error(f"Stderr: {stderr}")
            error_msg = stderr if stderr.strip() else stdout
            return jsonify({
                "status": "error", 
                "error": f"Cookie update failed: {error_msg}"
            }), 500
        
        logger.info("Cookie update completed successfully")
        return jsonify({
            "status": "success",
            "message": "Cookies updated successfully",
            "output": stdout
        })
        
    except subprocess.TimeoutExpired:
        logger.error("Cookie update timed out")
        return jsonify({
            "status": "error",
            "error": "Cookie update timed out after 2 minutes"
        }), 500
    except Exception as e:
        logger.exception("Error updating cookies")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

@mcp_bp.route('/proxy_artifact', methods=['GET'])
def proxy_artifact():
    """Proxies an external artifact URL to bypass CORS."""
    url = request.args.get('url')
    if not url:
        return jsonify({"status": "error", "error": "Missing url parameter"}), 400
        
    logger.info(f"Proxying artifact URL: {url}")

    # Configuration for auth file
    auth_dir = os.path.join(os.path.expanduser("~"), ".notebooklm-mcp")
    auth_path = os.path.join(auth_dir, "auth.json")
    
    cookie_dict = {}
    if os.path.exists(auth_path):
        try:
            with open(auth_path, 'r') as f:
                auth_data = json.load(f)
                cookie_dict = auth_data.get('cookies', {})
        except Exception as e:
            logger.error(f"Failed to load auth cookies: {e}")

    try:
        # Add authuser=0 if not present to force primary session
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        if 'authuser' not in params:
            params['authuser'] = ['0']
            new_query = urlencode(params, doseq=True)
            url = urlunparse(parsed._replace(query=new_query))

        # Use requests.Session for better handling of Google's complex cross-domain redirects
        session = requests.Session()
        session.max_redirects = 50
        # Map the flat cookie dict into a domain-scoped cookie jar
        # Include OSID and other critical cookies for cross-domain auth
        critical_cookies = [
            'SID', 'HSID', 'SSID', 'APISID', 'SAPISID', 
            '__Secure-1PSID', '__Secure-3PSID', 'NID', 
            '__Secure-1PSIDTS', '__Secure-3PSIDTS',
            'OSID', '__Secure-OSID', 'LSID', '__Host-1PLSID', 
            '__Host-3PLSID', '__Host-GAPS'
        ]
        for name, value in cookie_dict.items():
            if name in critical_cookies or name.startswith('__Secure-'):
                session.cookies.set(name, value, domain=".google.com")
                session.cookies.set(name, value, domain=".googleusercontent.com")
                # Also specifically for the naked host if needed
                session.cookies.set(name, value, domain="lh3.googleusercontent.com")
        
        # Use 'Gold Standard' headers that Google expects for authenticated resource fetching
        browser_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Ch-Ua": '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "image",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "cross-site",
            "Referer": "https://notebooklm.google.com/",
            "X-Client-Data": "CIa2yQEIorbJAQipncoBCI79ygEIlKHLAQ==" # Generic valid client data
        }
        session.headers.update(browser_headers)
        
        # Execute the request
        resp = session.get(url, allow_redirects=True, timeout=30.0)
        logger.info(f"Proxy request finished. Status: {resp.status_code}, Final URL: {resp.url}")

        # Check for Google Login redirect (stale session or auth required for this specific subdomain)
        if "accounts.google.com" in str(resp.url) or "ServiceLogin" in str(resp.url):
             logger.warning("Session expired or domain mismatch. Landed on login page. Triggering auto-refresh...")
             try:
                 # Ensure the subprocess uses the local src/ for the package
                 refresh_env = os.environ.copy()
                 src_path = os.path.join(MCP_DIR, 'src')
                 if src_path not in refresh_env.get('PYTHONPATH', ''):
                     refresh_env['PYTHONPATH'] = f"{src_path}{os.pathsep}{refresh_env.get('PYTHONPATH', '')}"

                 # Run headless refresh to get fresh tokens
                 subprocess.run([MCP_VENV_PYTHON, "-m", "notebooklm_mcp.auth_cli", "--headless"], env=refresh_env, capture_output=True, timeout=60, check=True)
                 
                 # Reload new cookies
                 with open(auth_path, 'r') as f:
                     new_data = json.load(f)
                     new_cookies = new_data.get('cookies', {})
                     for k, v in new_cookies.items():
                         session.cookies.set(k, v, domain=".google.com")
                         session.cookies.set(k, v, domain=".googleusercontent.com")
                         session.cookies.set(k, v, domain="lh3.googleusercontent.com")
                 
                 # Retry once
                 resp = session.get(url, allow_redirects=True, timeout=30.0)
                 logger.info(f"Retry finished. Status: {resp.status_code}, Final URL: {resp.url}")
             except Exception as e:
                 logger.error(f"Auto-refresh or retry failed: {e}")

        # If we're STILL on a login page or support page, it's a hard fail
        if "accounts.google.com" in str(resp.url) or "support.google.com" in str(resp.url):
            return jsonify({
                "status": "error", 
                "error": "Authentication failed. Redirected to Google login/security page.",
                "is_auth_error": True,
                "final_url": str(resp.url)
            }), 401

        resp.raise_for_status()
        
        # Check for media content type
        content_type = resp.headers.get('Content-Type', 'image/png')
        if 'text/html' in content_type:
            return jsonify({
                "status": "error", 
                "error": f"Expected media, got HTML ({content_type}). Auth likely failed.",
                "is_auth_error": True
            }), 401

        response_headers = {
            'Content-Type': content_type,
            'Access-Control-Allow-Origin': '*',
            'Content-Disposition': f'inline; filename="artifact_{int(time.time())}.png"'
        }
        
        return Response(
            resp.content,
            status=resp.status_code,
            headers=response_headers
        )
    except Exception as e:
        logger.error(f"Failed to proxy artifact: {e}")
        return jsonify({"status": "error", "error": str(e)}), 500
