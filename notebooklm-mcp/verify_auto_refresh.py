import sys
import os

# Add src to path so we can import local notebooklm_mcp
current_dir = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(current_dir, 'src')
sys.path.append(src_path)

from notebooklm_mcp.api_client import NotebookLMClient
from notebooklm_mcp.auth import save_tokens_to_cache, AuthTokens
import time

def verify_auto_refresh():
    # 1. Setup: Save "expired" cookies to auth.json
    print("[TEST] Setting up expired cookies...")
    bad_tokens = AuthTokens(
        cookies={"SID": "INVALID_COOKIE_FOR_TESTING"},
        csrf_token="invalid",
        session_id="invalid",
        extracted_at=time.time() - 1000000
    )
    save_tokens_to_cache(bad_tokens)

    # 2. Initialize Client
    print("[TEST] Initializing NotebookLMClient (expecting auto-healing)...")
    try:
        # This should trigger the ValueError -> subprocess call -> reload
        client = NotebookLMClient(
            cookies=bad_tokens.cookies, 
            csrf_token=bad_tokens.csrf_token, 
            session_id=bad_tokens.session_id
        )
        print("[TEST] SUCCESS: Client initialized without error!")
        
        # 3. Verify tokens are different
        print(f"[TEST] New SID: {client.cookies.get('SID')[:10]}...")
        if client.cookies.get('SID') == "INVALID_COOKIE_FOR_TESTING":
            print("[TEST] FAIL: Cookies were not updated!")
        else:
            print("[TEST] PASS: Cookies were updated.")
            
    except Exception as e:
        print(f"[TEST] FAIL: Client initialization failed: {e}")

if __name__ == "__main__":
    verify_auto_refresh()
