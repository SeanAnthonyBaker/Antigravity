import httpx
import os
import sys

# Log to file directly
log_path = os.path.join(os.getcwd(), "cookies_debug.log")
log_file = open(log_path, "w", encoding='utf-8', buffering=1)
sys.stdout = log_file
sys.stderr = log_file

def main():
    print("Starting cookie test...")
    try:
        sys.path.insert(0, os.path.join(os.getcwd(), "src"))
        from notebooklm_mcp.auth import load_cached_tokens
        tokens = load_cached_tokens()
        if not tokens:
            print("ERROR: No tokens found!")
            return
        cookies = tokens.cookies
        print(f"Loaded {len(cookies)} cookies.")

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        print("Making request to https://notebooklm.google.com/ ...")
        with httpx.Client(follow_redirects=True, timeout=20.0) as client:
            response = client.get("https://notebooklm.google.com/", cookies=cookies, headers=headers)
            
            print(f"Status: {response.status_code}")
            print(f"Final URL: {response.url}")
            print(f"History: {[r.status_code for r in response.history]}")
            
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
