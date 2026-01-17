import requests
import json
import sys

BASE_URL = "http://127.0.0.1:5000/api/mcp"

def test_list_notebooks():
    print("Testing GET /notebooks...")
    try:
        response = requests.get(f"{BASE_URL}/notebooks")
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                notebooks = data.get("notebooks", [])
                print(f"SUCCESS: Retrieved {len(notebooks)} notebooks.")
                if notebooks:
                    return notebooks[0]['id']
                else:
                    print("WARNING: No notebooks found.")
                    return None
            else:
                print(f"FAILURE: API returned error: {data.get('error')}")
                return None
        else:
            print(f"FAILURE: HTTP {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"EXCEPTION: {e}")
        return None

def test_query_notebook(notebook_id):
    if not notebook_id:
        print("Skipping query test (no notebook ID).")
        return

    print(f"\nTesting POST /query with notebook {notebook_id}...")
    payload = {
        "notebook_id": notebook_id,
        "query": "What is the main topic of this notebook?"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/query", json=payload)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                answer = data.get("answer", "")
                print(f"SUCCESS: Query executed.")
                print(f"Answer snippet: {answer[:100]}...")
            else:
                print(f"FAILURE: API returned error: {data.get('error')}")
        else:
            print(f"FAILURE: HTTP {response.status_code} - {response.text}")
    except Exception as e:
        print(f"EXCEPTION: {e}")

if __name__ == "__main__":
    nb_id = test_list_notebooks()
    if nb_id:
        test_query_notebook(nb_id)
