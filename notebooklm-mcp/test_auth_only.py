#!/usr/bin/env python3
import asyncio
import sys
import os
import json
from pathlib import Path

# Add src to path so we can import notebooklm_mcp
current_dir = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(current_dir, 'src')
sys.path.append(src_path)

async def test_api():
    from notebooklm_mcp.api_client import NotebookLMClient
    
    # Load auth.json manually
    cache_path = Path.home() / '.notebooklm-mcp' / 'auth.json'
    if not cache_path.exists():
        print(f"[FAIL] {cache_path} does not exist")
        return False
        
    try:
        with open(cache_path) as f:
            data = json.load(f)
            cookies = data.get('cookies', {})
            csrf = data.get('csrf_token', '')
            sid = data.get('session_id', '')
            
        print(f"Loaded {len(cookies)} cookies from cache")
        
        # Test client initialization (which verifies cookies by fetching CSRF)
        print("\nInitializing NotebookLMClient (verifies cookies)...")
        client = NotebookLMClient(cookies=cookies, csrf_token=csrf, session_id=sid)
        print("[OK] Client initialized (CSRF check passed)")
        
        # Test listing notebooks
        print("\nListing notebooks...")
        notebooks = client.list_notebooks()
        print(f"[OK] SUCCESS: Listed {len(notebooks)} notebooks")
        
        if notebooks:
            print("\nFirst 3 notebooks:")
            for nb in notebooks[:3]:
                print(f"  - {nb.id}: {nb.title}")
        
        return True
    except Exception as e:
        print(f"[FAIL] {e}")
        # import traceback
        # traceback.print_exc()
        return False

if __name__ == "__main__":
    asyncio.run(test_api())
