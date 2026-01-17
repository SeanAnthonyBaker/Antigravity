import requests
import json

NOTEBOOK_ID = "912191f6-609b-4417-9489-f321e90e8c93"
QUERY = "The title deals with '31 Tools'. Please list all 31 tools or functions mentioned. Group them by category (e.g. Ingestion, Understanding, Generation, Integration). Output as a markdown list."

def query_notebook():
    print(f"Querying notebook {NOTEBOOK_ID}...")
    try:
        response = requests.post(
            "http://127.0.0.1:5000/api/mcp/query",
            json={"notebook_id": NOTEBOOK_ID, "query": QUERY}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                print("\n--- RESPONSE ---\n")
                print(data.get("answer"))
                print("\n----------------\n")
            else:
                print(f"Error: {data.get('error')}")
        else:
            print(f"HTTP Error: {response.status_code}")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    query_notebook()
