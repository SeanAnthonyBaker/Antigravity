import httpx
import os
import sys

# Log to file directly
log_path = os.path.join(os.getcwd(), "cookies_debug_v2.log")
log_file = open(log_path, "w", encoding='utf-8', buffering=1)
sys.stdout = log_file
sys.stderr = log_file

def load_cookies(path="cookies.txt"):
    cookies = {}
    with open(path, "r", encoding="utf-8") as f:
        content = f.read().strip()
        # Handle format: KEY=VALUE; KEY=VALUE
        for part in content.split("; "):
            if "=" in part:
                k, v = part.split("=", 1)
                cookies[k] = v
    return cookies

def main():
    print("Starting cookie test v2...")
    try:
        cookies = load_cookies()
        print(f"Loaded {len(cookies)} cookies.")
        
        # Headers exactly matching api_client.py
        _PAGE_FETCH_HEADERS = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
        }

        print("Making request to https://notebooklm.google.com/ ...")
        with httpx.Client(follow_redirects=True, timeout=20.0) as client:
            response = client.get("https://notebooklm.google.com/", cookies=cookies, headers=_PAGE_FETCH_HEADERS)
            
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
