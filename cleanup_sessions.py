import requests
import sys

HUB = "http://localhost:4444/wd/hub"
STATUS_URL = f"{HUB}/status"

try:
    print(f"Checking status at {STATUS_URL}...")
    resp = requests.get(STATUS_URL, timeout=5)
    resp.raise_for_status()
    data = resp.json()
    
    nodes = data.get('value', {}).get('nodes', [])
    count = 0
    for node in nodes:
        for slot in node.get('slots', []):
            sess = slot.get('session')
            if sess:
                sid = sess.get('sessionId')
                if sid:
                    print(f"Deleting session {sid}...")
                    try:
                        requests.delete(f"{HUB}/session/{sid}", timeout=5)
                        count += 1
                    except Exception as e:
                        print(f"Failed to delete {sid}: {e}")
    print(f"Cleared {count} sessions.")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
