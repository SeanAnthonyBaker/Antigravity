import httpx
import json
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_proxy_httpx")

def test_url(url):
    auth_path = os.path.join(os.path.expanduser("~"), ".notebooklm-mcp", "auth.json")
    if not os.path.exists(auth_path):
        print("No auth.json found")
        return
    
    with open(auth_path, 'r') as f:
        auth_data = json.load(f)
        cookies = auth_data.get('cookies', {})

    headers = {
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
        "Referer": "https://notebooklm.google.com/",
    }

    print(f"Testing URL with httpx: {url}")
    try:
        # Use cookies property instead of header
        with httpx.Client(headers=headers, cookies=cookies, follow_redirects=True, timeout=30.0) as client:
            resp = client.get(url)
            print(f"Final Status: {resp.status_code}")
            print(f"Final URL: {resp.url}")
            print(f"Content-Type: {resp.headers.get('Content-Type')}")
            
            for i, r in enumerate(resp.history):
                print(f"Hop {i}: {r.status_code} -> {r.url}")
            
            if "accounts.google.com" in str(resp.url):
                print("FAILURE: Redirected to login")
            else:
                print("SUCCESS!")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_url("https://lh3.googleusercontent.com/notebooklm/AG60hOrS6tCkij0IGNx4ONIFCT1a_otuua_Od-KxNiR2D4ggD1ZhNqFhI4GGnBlY9KnPMXkjgyRAfG4DdYgQXuClYHOwiydeaOqnPeQP-aAa3785jmTDgugvHorUdc6VUTySXEwYkYrgTjlJL8qpgz-gKMXQAHGsj6c=w2752-d-h1536-mp2")
