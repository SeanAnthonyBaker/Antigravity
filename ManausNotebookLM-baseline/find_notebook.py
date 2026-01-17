import requests
import json

def get_notebook_id(title_substring):
    try:
        response = requests.get("http://127.0.0.1:5000/api/mcp/notebooks")
        if response.status_code != 200:
            print(f"Error: HTTP {response.status_code}")
            return None
            
        data = response.json()
        if data.get("status") != "success":
            print(f"Error: API status {data.get('status')}")
            return None
            
        notebooks = data.get("notebooks", [])
        for nb in notebooks:
            if title_substring.lower() in nb.get("title", "").lower():
                print(f"Found Notebook: {nb['title']}")
                print(f"ID: {nb['id']}")
                return nb['id']
                
        print("Notebook not found.")
        return None
    except Exception as e:
        print(f"Exception: {e}")
        return None

if __name__ == "__main__":
    get_notebook_id("31 Tools")
