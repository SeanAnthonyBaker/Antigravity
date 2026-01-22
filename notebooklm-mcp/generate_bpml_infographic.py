import sys
import os
import json

# Configuration
NOTEBOOK_ID = "0dd87942-6a8a-41aa-b49f-9e30c4bafb4b"
FOCUS_PROMPT = "BPML validation"

sys.path.insert(0, os.path.join(os.getcwd(), "src"))
from notebooklm_mcp.api_client import NotebookLMClient
from notebooklm_mcp.auth import load_cached_tokens

def main():
    print(f"Starting infographic generation for notebook: {NOTEBOOK_ID}")
    
    tokens = load_cached_tokens()
    if not tokens:
        print("Error: No cached tokens found.")
        sys.exit(1)
        
    client = NotebookLMClient(cookies=tokens.cookies)
    
    print("Retrieving sources...")
    sources = client.get_notebook_sources_with_types(NOTEBOOK_ID)
    source_ids = [s["id"] for s in sources if s.get("id")]
    
    if not source_ids:
        print("Error: No sources found in the notebook.")
        sys.exit(1)
        
    print(f"Found {len(source_ids)} sources. Creating infographic...")
    
    result = client.create_infographic(
        notebook_id=NOTEBOOK_ID,
        source_ids=source_ids,
        orientation_code=1,  # landscape
        detail_level_code=3,  # detailed
        language="en",
        focus_prompt=FOCUS_PROMPT
    )
    
    if result:
        print("SUCCESS! Infographic generation started.")
        print(json.dumps(result, indent=2))
    else:
        print("FAILED to create infographic.")

if __name__ == "__main__":
    main()
