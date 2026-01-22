import json
import os

auth_path = os.path.join(os.path.expanduser("~"), ".notebooklm-mcp", "auth.json")
if os.path.exists(auth_path):
    with open(auth_path, 'r') as f:
        data = json.load(f)
        cookies = data.get('cookies', {})
        print(f"Total cookies: {len(cookies)}")
        for k in cookies:
            print(f"Cookie: {k}")
else:
    print("No auth.json")
