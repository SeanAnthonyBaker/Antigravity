#!/usr/bin/env python3
"""Verify authentication is fixed"""
import asyncio
import json
import time
import os
import sys
from pathlib import Path
import httpx

# Ensure we can import from src
sys.path.insert(0, os.path.join(os.getcwd(), "src"))
from notebooklm_mcp.auth import load_cached_tokens

# Test cookies
def test_cookies():
    print("Loading cached auth tokens...")
    tokens = load_cached_tokens()
    if not tokens:
        print("[FAIL] No cached tokens found! Run 'notebooklm-mcp-auth' first.")
        return False
        
    cookies = tokens.cookies
    print(f"[OK] Loaded {len(cookies)} cookies from auth.json.")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    }
    
    print("\nTesting cookies against https://notebooklm.google.com/ ...")
    with httpx.Client(follow_redirects=True, timeout=20.0, cookies=cookies, headers=headers) as client:
        response = client.get('https://notebooklm.google.com/')
        
        print(f"Final URL: {response.url}")
        if 'accounts.google.com' in str(response.url):
            print("[FAIL] Cookies are expired (redirected to login)")
            return False
        else:
            print(f"[OK] SUCCESS: Authenticated (status {response.status_code})")
            
            # Check for CSRF token
            import re
            csrf = re.search(r'"SNlM0e":"([^"]+)"', response.text)
            if csrf:
                print(f"[OK] Found CSRF token in page: {csrf.group(1)[:30]}...")
            else:
                print("[WARN] Could not extract CSRF token (SNlM0e) from page source")
            
            return True

# Test NotebookLM API
def test_api():
    from notebooklm_mcp.api_client import NotebookLMClient
    
    print("\nTesting NotebookLM API Client...")
    try:
        tokens = load_cached_tokens()
        client = NotebookLMClient(cookies=tokens.cookies if tokens else None)
        notebooks = client.list_notebooks()
        print(f"[OK] SUCCESS: Listed {len(notebooks)} notebooks")
        
        if notebooks:
            print("\nFirst 3 notebooks:")
            for nb in notebooks[:3]:
                print(f"  - {nb.title} (ID: {nb.id})")
        
        return True
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("AUTHENTICATION VERIFICATION")
    print("=" * 60)
    
    # Step 1: Test cookies
    cookies_ok = test_cookies()
    
    # Step 2: Test API
    if cookies_ok:
        api_ok = test_api()
        
        print("\n" + "=" * 60)
        if cookies_ok and api_ok:
            print("[OK] ALL TESTS PASSED - Authentication is FIX!")
        else:
            print("[FAIL] SOME TESTS FAILED - Authentication needs attention")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("[FAIL] Cookie test failed - skipping API test")
        print("=" * 60)

if __name__ == "__main__":
    main()
