import json
import os
import sys
import time
from pathlib import Path

def update_auth_json(cookie_string):
    # Parse cookie string into dict
    cookies = {}
    for item in cookie_string.split(';'):
        if '=' in item:
            name, value = item.strip().split('=', 1)
            cookies[name] = value
    
    # Path to auth.json
    cache_dir = Path.home() / '.notebooklm-mcp'
    cache_dir.mkdir(exist_ok=True)
    cache_path = cache_dir / 'auth.json'
    
    # Create token data
    token_data = {
        "cookies": cookies,
        "csrf_token": "", # Will be auto-extracted
        "session_id": "", # Will be auto-extracted
        "extracted_at": time.time()
    }
    
    # Write to file
    with open(cache_path, 'w') as f:
        json.dump(token_data, f, indent=2)
    
    print(f"Successfully updated auth.json at {cache_path}")
    print(f"Saved {len(cookies)} cookies.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python update_auth_json.py <cookie_string>")
        sys.exit(1)
    
    cookie_str = sys.argv[1]
    update_auth_json(cookie_str)
