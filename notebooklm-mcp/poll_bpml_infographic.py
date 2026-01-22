import sys
import os
import json
import time

# Configuration
NOTEBOOK_ID = "0dd87942-6a8a-41aa-b49f-9e30c4bafb4b"
ARTIFACT_ID = "4aac8255-40eb-44ec-b6be-1e5c82981ba6"

sys.path.insert(0, os.path.join(os.getcwd(), "src"))
from notebooklm_mcp.api_client import NotebookLMClient
from notebooklm_mcp.auth import load_cached_tokens

def main():
    tokens = load_cached_tokens()
    client = NotebookLMClient(cookies=tokens.cookies)
    
    print(f"Polling for infographic {ARTIFACT_ID}...")
    
    while True:
        artifacts = client.poll_studio_status(NOTEBOOK_ID)
        target = next((a for a in artifacts if a["artifact_id"] == ARTIFACT_ID), None)
        
        if not target:
            print("Error: Artifact not found!")
            break
            
        status = target.get("status")
        print(f"Current Status: {status}")
        
        if status == "completed":
            print("SUCCESS! Infographic is ready.")
            print(json.dumps(target, indent=2))
            break
        elif status == "failed":
            print("Error: Infographic generation failed.")
            break
            
        time.sleep(30)

if __name__ == "__main__":
    main()
