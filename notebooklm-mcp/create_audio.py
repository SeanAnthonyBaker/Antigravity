import sys
import os

# Log to file directly
log_path = os.path.join(os.getcwd(), "script_run.log")
log_file = open(log_path, "w", encoding='utf-8', buffering=1)
sys.stdout = log_file
sys.stderr = log_file

print("Starting script execution...")

def load_cookies(path="cookies.txt"):
    cookies = {}
    with open(path, "r", encoding="utf-8") as f:
        content = f.read().strip()
        for part in content.split("; "):
            if "=" in part:
                k, v = part.split("=", 1)
                cookies[k] = v
    return cookies

try:
    # Ensure we can import from src
    sys.path.insert(0, os.path.join(os.getcwd(), "src"))
    
    from notebooklm_mcp.api_client import NotebookLMClient
    print("Import successful.")

    print("Loading cookies from cookies.txt...")
    cookies = load_cookies()
    print(f"Loaded {len(cookies)} cookies.")
    
    print("Initializing client...")
    try:
        client = NotebookLMClient(cookies=cookies)
    except Exception as e:
        print(f"Failed to initialize client: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    target_title = "Mastering the NotebookLM MCP Server: 31 Tools for Integration"
    print(f"Searching for notebook: '{target_title}'...")
    
    try:
        notebooks = client.list_notebooks()
    except Exception as e:
        print(f"Failed to list notebooks: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    target_notebook = next((nb for nb in notebooks if nb.title == target_title), None)

    if not target_notebook:
        print(f"Notebook not found. Available notebooks ({len(notebooks)}):")
        for nb in notebooks:
            print(f"- {nb.title}")
        sys.exit(1)

    print(f"Found notebook: {target_notebook.id}")

    print("Starting audio generation (Format: Deep Dive, Length: Long for ~10 min)...")
    try:
        # Get source IDs
        sources = client.get_notebook_sources_with_types(target_notebook.id)
        source_ids = [s["id"] for s in sources if s["id"]]
        
        if not source_ids:
            print("No sources found in notebook!")
            sys.exit(1)
            
        print(f"Using {len(source_ids)} sources.")

        # format: deep_dive = 1
        # length: long = 3 (for ~10 min audio)
        result = client.create_audio_overview(
            notebook_id=target_notebook.id,
            source_ids=source_ids,
            format_code=1, # deep_dive
            length_code=3, # long (~10 min)
            language="en",
            focus_prompt=""
        )
        print("Success! Audio generation started.")
        print(f"Result: {result}")
        print(f"Artifact ID: {result.get('artifact_id')}")
        print(f"Check studio_status for progress.")
        
    except Exception as e:
        print(f"Error creating audio: {e}")
        import traceback
        traceback.print_exc()

except Exception as outer_e:
    print(f"Outer error: {outer_e}")
    import traceback
    traceback.print_exc()
finally:
    print("Script finished.")
    log_file.close()
