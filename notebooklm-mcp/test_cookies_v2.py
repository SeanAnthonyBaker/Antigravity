import httpx
import os
import sys

# Log to file directly
log_path = os.path.join(os.getcwd(), "cookies_debug_v2.log")
log_file = open(log_path, "w", encoding='utf-8', buffering=1)
sys.stdout = log_file
sys.stderr = log_file

def main():
    print("Starting cookie test v2...")
    try:
        sys.path.insert(0, os.path.join(os.getcwd(), "src"))
        from notebooklm_mcp.auth import load_cached_tokens
        
        tokens = load_cached_tokens()
        if not tokens:
            print("No cached tokens found!")
            return
            
        cookies = tokens.cookies
        print(f"Loaded {len(cookies)} cookies from auth.json.")
        
        # Headers exactly matching api_client.py
        _PAGE_FETCH_HEADERS = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }

        print("Making request to https://notebooklm.google.com/ ...")
        with httpx.Client(follow_redirects=True, timeout=20.0, cookies=cookies, headers=_PAGE_FETCH_HEADERS) as client:
            response = client.get("https://notebooklm.google.com/")
            
            print(f"Status: {response.status_code}")
            print(f"Final URL: {response.url}")
            
            if "accounts.google.com" in str(response.url):
                print("ERROR: Redirected to login page. Cookies are EXPIRED or INVALID.")
            else:
                print("SUCCESS: Stayed on notebooklm.google.com (or compatible domain).")
                import re
                csrf = re.search(r'"SNlM0e":"([^"]+)"', response.text)
                if csrf:
                    print(f"Found CSRF token: {csrf.group(1)}")
                else:
                    print("WARNING: Could not find CSRF token (SNlM0e) in page source.")
                    
    except Exception as e:
        print(f"Exception: {e}")
        import traceback
        traceback.print_exc()
        
    print("Test finished.")

if __name__ == "__main__":
    main()
