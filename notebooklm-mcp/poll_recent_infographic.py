import os
import sys
import json

# Add src to path
sys.path.insert(0, os.path.join(os.getcwd(), "src"))

from notebooklm_mcp.server import get_client

def main():
    notebook_id = "637db15a-c0c3-4093-ba80-51202d1c89e3"
    artifact_id = "cd299cd9-00a7-4e9c-a5b5-02e41d880d79"
    
    client = get_client()
    print(f"Polling status for notebook: {notebook_id}")
    artifacts = client.poll_studio_status(notebook_id)
    
    for art in artifacts:
        if art['artifact_id'] == artifact_id:
            print(f"Found artifact: {art['artifact_id']}")
            print(f"Status: {art['status']}")
            print(f"URL: {art.get('infographic_url')}")
            print(json.dumps(art, indent=2))
            return

    print("Artifact not found in recent studio status.")

if __name__ == "__main__":
    main()
