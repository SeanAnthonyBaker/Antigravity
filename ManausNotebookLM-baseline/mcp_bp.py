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

import sys

# Configuration - adjust paths as needed
# Using absolute paths to ensure robustness
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MCP_DIR = os.path.join(BASE_DIR, 'notebooklm-mcp')

# Ensure notebooklm-mcp source is in path for imports
src_path = os.path.join(MCP_DIR, 'src')
if src_path not in sys.path:
    sys.path.append(src_path)

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
    """Fetches the list of notebooks using the NLM CLI client."""
    logger.info("Fetching notebooks via NLM CLI...")
    
    try:
        from nlm_client import NLMClient, NLMClientError
        
        try:
            client = NLMClient(profile="default")
            notebooks = client.list_notebooks()
            
            # Format notebooks for frontend compatibility
            formatted = []
            for nb in notebooks:
                formatted.append({
                    "id": nb.get("id") or nb.get("notebook_id"),
                    "title": nb.get("title") or nb.get("name", "Untitled"),
                    "source_count": nb.get("source_count", 0),
                    "url": f"https://notebooklm.google.com/notebook/{nb.get('id') or nb.get('notebook_id')}",
                    "ownership": nb.get("ownership", "owned"),
                    "is_shared": nb.get("is_shared", False),
                    "created_at": nb.get("created_at"),
                    "modified_at": nb.get("modified_at")
                })
            
            return jsonify({
                "status": "success",
                "notebooks": formatted
            })
            
        except NLMClientError as e:
            logger.error(f"NLM client error listing notebooks: {e}")
            return jsonify({
                "status": "error",
                "error": f"NLM authentication failed: {str(e)}. Please run 'nlm login' on your host machine."
            }), 401
            
    except ImportError:
        return jsonify({
            "status": "error",
            "error": "NLM client not available"
        }), 500
    except Exception as e:
        logger.exception("Error listing notebooks")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

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

    except Exception as e:
        logger.exception(f"Error generating {artifact_type}")
        return jsonify({"status": "error", "error": str(e)}), 500

# Load schema on module level
SCHEMA_PATH = os.path.join(BASE_DIR, 'ManausNotebookLM-baseline', 'artifact_schema.json')
ARTIFACT_SCHEMA = None

def load_schema():
    global ARTIFACT_SCHEMA
    try:
        if os.path.exists(SCHEMA_PATH):
            with open(SCHEMA_PATH, 'r') as f:
                ARTIFACT_SCHEMA = json.load(f)
            logger.info(f"Loaded artifact schema from {SCHEMA_PATH}")
        else:
            logger.warning(f"Artifact schema not found at {SCHEMA_PATH}")
    except Exception as e:
        logger.error(f"Failed to load artifact schema: {e}")

# Initial load
load_schema()

def validate_artifact_params(artifact_type, params):
    """Validates parameters against the loaded JSON schema."""
    if not ARTIFACT_SCHEMA:
        load_schema()
        if not ARTIFACT_SCHEMA:
            return None # Skip validation if schema missing

    type_def = ARTIFACT_SCHEMA.get('definitions', {}).get('artifact_types', {}).get(artifact_type)
    if not type_def:
        return f"Unknown artifact type: {artifact_type}"
    
    schema_params = type_def.get('params', {})
    
    # Check required params
    for param_name, config in schema_params.items():
        if config.get('required') and param_name not in params:
             return f"Missing required parameter for {artifact_type}: '{param_name}'"
        
        # Check enums if present and value is provided
        if param_name in params:
            allowed = config.get('enum')
            if allowed and params[param_name] not in allowed:
                return f"Invalid value for '{param_name}'. Allowed: {allowed}, Got: '{params[param_name]}'"

    return None

@mcp_bp.route('/generate_artifact', methods=['POST'])
def generate_artifact():
    """Generates an artifact using the direct Python client."""
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "error": "No data provided"}), 400
        
    notebook_id = data.get('notebook_id')
    artifact_type = data.get('artifact_type')
    
    # Extract known optional parameters to pass explicitly or via **kwargs
    # We maintain 'prompt' for backward compatibility but map it to specific fields below
    prompt = data.get('prompt', '') 
    title = data.get('title', 'Generated Artifact')
    user_id = data.get('user_id')
    node_id = data.get('node_id')
    
    if not notebook_id or not artifact_type:
        return jsonify({"status": "error", "error": "Missing notebook_id or artifact_type"}), 400

    # VALIDATION
    validation_error = validate_artifact_params(artifact_type, data)
    if validation_error:
        return jsonify({"status": "error", "error": validation_error}), 400

    logger.info(f"Generating {artifact_type} for notebook {notebook_id}...")

    try:
        # Import the nlm CLI wrapper
        from nlm_client import NLMClient, NLMClientError
        
        try:
            client = NLMClient(profile="default")
        except Exception as e:
            return jsonify({"status": "error", "error": f"Failed to initialize NLM client: {e}"}), 500
        
        # Get source IDs (required for most operations)
        sources = client.get_notebook_sources_with_types(notebook_id)
        source_ids = [s['id'] for s in sources if s.get('id')]
        
        if not source_ids:
             return jsonify({"status": "error", "error": "Notebook has no sources to generate content from."}), 400

        result = None
        final_url = f"https://notebooklm.google.com/notebook/{notebook_id}"
        
        # Dispatch based on type
        if artifact_type == 'mind_map':
            # Mind map: just call save_mind_map directly (generate_mind_map is a placeholder)
            result = client.save_mind_map(
                notebook_id, 
                {},  # mind_map_json not actually used by CLI
                source_ids, 
                title=title
            )
                
        elif artifact_type == 'audio':
            result = client.create_audio_overview(
                notebook_id, 
                source_ids, 
                focus_prompt=data.get('focus') or prompt,
                format=data.get('format', 'deep_dive'),
                length=data.get('length', 'default'),
                language=data.get('language', 'en')
            )
            
        elif artifact_type == 'video':
            result = client.create_video_overview(
                notebook_id, 
                source_ids, 
                focus_prompt=data.get('focus') or prompt
            )
            
        elif artifact_type == 'report':
            result = client.create_report(
                notebook_id, 
                source_ids, 
                custom_prompt=data.get('prompt') or prompt, # Maps to 'prompt' in schema
                report_format=data.get('format', 'Briefing Doc')
            )
            
        elif artifact_type == 'flashcards':
            result = client.create_flashcards(
                notebook_id, 
                source_ids
            )
            
        elif artifact_type == 'quiz':
            result = client.create_quiz(
                notebook_id, 
                source_ids
            )
            
        elif artifact_type == 'infographic':
            result = client.create_infographic(
                notebook_id, 
                source_ids, 
                focus_prompt=data.get('focus') or prompt
            )
            
        elif artifact_type == 'slide_deck':
            result = client.create_slide_deck(
                notebook_id, 
                source_ids, 
                focus_prompt=data.get('focus') or prompt
            )
            
        elif artifact_type == 'data_table':
            result = client.create_data_table(
                notebook_id, 
                source_ids, 
                description=data.get('description') or prompt
            )
            
        else:
            return jsonify({"status": "error", "error": f"Unknown artifact type: {artifact_type}"}), 400

        if result:
            # Save to Supabase if user_id is provided
            saved_record = None
            if user_id:
                try:
                    from supabase_client import save_generated_artifact
                    
                    # Extract artifact URL from result based on type
                    artifact_url = None
                    nlm_artifact_id = None
                    if isinstance(result, dict):
                        artifact_url = result.get('url') or result.get('audio_url') or result.get('video_url') or result.get('infographic_url') or result.get('slide_deck_url')
                        nlm_artifact_id = result.get('id') or result.get('artifact_id')
                    
                    saved_record = save_generated_artifact(
                        user_id=user_id,
                        notebook_id=notebook_id,
                        artifact_type=artifact_type,
                        artifact_name=title,
                        nlm_artifact_id=nlm_artifact_id,
                        artifact_url=artifact_url,
                        node_id=node_id
                    )
                    if saved_record:
                        logger.info(f"Artifact saved to Supabase with ID: {saved_record.get('id')}")
                except Exception as save_err:
                    logger.warning(f"Failed to save artifact to Supabase: {save_err}")
                    # Don't fail the request if DB save fails
            
            return jsonify({
                "status": "success",
                "message": f"{artifact_type} generation started/completed.",
                "url": final_url,
                "details": result,
                "saved_to_db": saved_record is not None,
                "db_record_id": saved_record.get('id') if saved_record else None
            })
        else:
             return jsonify({"status": "error", "error": "Generation function returned no result"}), 500

    except Exception as e:
        logger.exception(f"Error generating {artifact_type}")
        return jsonify({"status": "error", "error": str(e)}), 500

@mcp_bp.route('/status/<notebook_id>', methods=['GET'])
def get_status(notebook_id):
    """Checks the status of artifacts for a notebook using direct client."""
    logger.info(f"Polling status for notebook {notebook_id} via direct client...")
    
    try:
        # Import the nlm CLI wrapper
        from nlm_client import NLMClient, NLMClientError
        
        try:
            client = NLMClient(profile="default")
        except Exception as e:
            return jsonify({"status": "error", "error": f"Failed to initialize NLM client: {e}"}), 500
        artifacts = client.poll_studio_status(notebook_id)
        
        # Normalize artifacts
        normalized = []
        for a in artifacts:
            # Map specific URL fields to generic 'url'
            url = a.get('infographic_url') or a.get('video_url') or a.get('audio_url') or a.get('slide_deck_url')
            
            normalized.append({
                "id": a.get('artifact_id'),
                "url": url,
                "status": a.get('status'),
                "title": a.get('title'),
                "type": a.get('type'),
                "created_at": a.get('created_at')
            })
            
        return jsonify({
            "status": "success", 
            "artifacts": normalized
        })
        
    except Exception as e:
        logger.exception(f"Error polling status for {notebook_id}")
        return jsonify({"status": "error", "error": str(e)}), 500

@mcp_bp.route('/update_cookies', methods=['POST'])
def update_cookies():
    """Verifies that valid NLM CLI authentication exists."""
    logger.info("Verifying NLM CLI authentication...")
    
    try:
        # Check if nlm CLI is accessible and authenticated
        from nlm_client import NLMClient, NLMClientError
        
        try:
            client = NLMClient(profile="default")
            # Try to list notebooks - this verifies auth is working
            notebooks = client.list_notebooks()
            
            logger.info(f"NLM auth verified successfully. Found {len(notebooks) if notebooks else 0} notebooks.")
            return jsonify({
                "status": "success",
                "message": "Session verified successfully (using NLM CLI authentication).",
                "notebook_count": len(notebooks) if notebooks else 0
            })
            
        except NLMClientError as e:
            logger.error(f"NLM client error: {e}")
            return jsonify({
                "status": "error",
                "error": f"NLM authentication failed: {str(e)}. Please run 'nlm login' on your host machine."
            }), 401
            
        except Exception as e:
            logger.error(f"NLM client initialization failed: {e}")
            return jsonify({
                "status": "error",
                "error": f"No cached tokens found. Please run 'nlm login' on your host machine."
            }), 404
        
    except ImportError:
        return jsonify({
            "status": "error",
            "error": "NLM client not available. Please ensure 'nlm_client.py' exists in the backend."
        }), 500
    except Exception as e:
        logger.exception("Error verifying NLM authentication")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

@mcp_bp.route('/trigger_login', methods=['POST'])
def trigger_login():
    """Triggers the NLM CLI login flow on the host machine."""
    import shutil
    
    logger.info("Triggering NLM CLI login...")
    
    # Check if nlm CLI is available
    nlm_path = shutil.which('nlm')
    if not nlm_path:
        return jsonify({
            "status": "error",
            "error": "NLM CLI not found. Please install with: uv tool install notebooklm-mcp-server"
        }), 404
    
    # In Docker, we can't open a browser - return instructions
    if os.path.exists('/.dockerenv'):
        return jsonify({
            "status": "manual_required",
            "message": "Running in Docker. Please run 'nlm login' on your host machine, then restart Docker."
        }), 200
    
    try:
        # Launch login in background (it opens a Chrome window)
        # Use CREATE_NEW_CONSOLE on Windows so the user can see the login progress
        creation_flags = subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
        subprocess.Popen([nlm_path, 'login'], creationflags=creation_flags)
        
        logger.info("NLM login window opened successfully")
        return jsonify({
            "status": "success",
            "message": "Login window opened. Complete authentication in the browser, then refresh this page."
        })
    except Exception as e:
        logger.exception("Error triggering NLM login")
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
