import os
import json
import logging
import subprocess
from flask import Blueprint, request, jsonify, Response, stream_with_context

mcp_bp = Blueprint('mcp_bp', __name__)
logger = logging.getLogger(__name__)

# Configuration - adjust paths as needed
# Using absolute paths to ensure robustness
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MCP_DIR = os.path.join(BASE_DIR, 'notebooklm-mcp')
MCP_VENV_PYTHON = os.path.join(MCP_DIR, '.venv', 'Scripts', 'python.exe')
MCP_BRIDGE_SCRIPT = os.path.join(MCP_DIR, 'mcp_bridge.py')

def run_bridge_command(command_payload):
    """Executes the bridge script with the given JSON payload."""
    try:
        if not os.path.exists(MCP_VENV_PYTHON):
            return {"status": "error", "error": f"MCP Python interpreter not found at {MCP_VENV_PYTHON}"}
        
        if not os.path.exists(MCP_BRIDGE_SCRIPT):
            return {"status": "error", "error": f"Bridge script not found at {MCP_BRIDGE_SCRIPT}"}

        # Run the subprocess
        process = subprocess.Popen(
            [MCP_VENV_PYTHON, MCP_BRIDGE_SCRIPT, '--json-input'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=MCP_DIR # Important to set CWD so imports work if needed
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
        return jsonify(result), 500

@mcp_bp.route('/query', methods=['POST'])
def query_notebook():
    """Executes a query against a specific notebook via MCP."""
    data = request.get_json()
    if not data or 'notebook_id' not in data or 'query' not in data:
        return jsonify({"status": "error", "error": "Missing notebook_id or query"}), 400
        
    notebook_id = data['notebook_id']
    query = data['query']
    
    logger.info(f"Querying notebook {notebook_id} via MCP bridge: {query}")
    
    payload = {
        "command": "query",
        "notebook_id": notebook_id,
        "query": query
    }
    
    # Note: notebooklm-mcp currently waits for the full response, it doesn't stream token by token 
    # in the same way the Selenium implementation does (which scrapes UI updates).
    # The MCP client.query() returns a single result object.
    # So we will return a standard JSON response effectively.
    
    result = run_bridge_command(payload)
    
    if result.get("status") == "success":
        return jsonify(result)
    else:
        return jsonify(result), 500
