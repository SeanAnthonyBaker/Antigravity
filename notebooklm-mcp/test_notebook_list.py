import sys
import os
import traceback

# Ensure we can import from src
sys.path.append(os.path.join(os.getcwd(), 'src'))

def log(msg):
    with open("test_log.txt", "a") as f:
        f.write(msg + "\n")
    print(msg)

log("--- Starting new run ---")

try:
    log("Importing get_client...")
    from notebooklm_mcp.server import get_client
    log("Import successful.")
    
    log("Calling get_client()...")
    client = get_client()
    log("Client object obtained.")

    log("Calling client.list_notebooks()...")
    notebooks = client.list_notebooks(debug=True)
    log(f"list_notebooks returned. Found {len(notebooks)} notebooks.")

    for nb in notebooks:
        msg = f"- {nb.title} (ID: {nb.id})"
        log(msg)
        
except Exception as e:
    log(f"Error occurred: {e}")
    log(traceback.format_exc())

log("--- End of run ---")
