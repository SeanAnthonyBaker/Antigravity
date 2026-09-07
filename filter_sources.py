import subprocess
import json
import sys

NOTEBOOK_ID = "b554f156-f548-4adb-97c6-ff4433e285b7"
KEYWORD = "MCP"

def get_notebook_data():
    cmd = ["nlm", "notebook", "get", NOTEBOOK_ID, "--json"]
    try:
        # Run nlm command
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            check=True
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error running nlm: {e}")
        print(f"Stderr: {e.stderr}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        print(f"Stdout snippet: {result.stdout[:200]}")
        sys.exit(1)

def main():
    print(f"Fetching notebook {NOTEBOOK_ID}...")
    data = get_notebook_data()
    
    if "sources" not in data:
        print("No sources found in response.")
        return

    sources = data["sources"]
    print(f"Found {len(sources)} total sources.")
    
    matches = [s for s in sources if KEYWORD in s.get("title", "") or KEYWORD in s.get("content", "")]
    
    print(f"\nSources containing '{KEYWORD}':")
    for s in matches:
        print(f"- [{s['id']}] {s['title']}")

if __name__ == "__main__":
    main()
