import sys
sys.path.insert(0, 'src')
from notebooklm_mcp.api_client import NotebookLMClient
from notebooklm_mcp.auth import load_cached_tokens
import requests
import os

tokens = load_cached_tokens()
client = NotebookLMClient(cookies=tokens.cookies)
artifacts = client.poll_studio_status('637db15a-c0c3-4093-ba80-51202d1c89e3')

# Get the most recent infographic
infographics = [a for a in artifacts if a.get('type') == 'infographic']
if not infographics:
    print("No infographics found!")
    sys.exit(1)

# Sort by created_at descending to get most recent
infographics.sort(key=lambda x: x.get('created_at', ''), reverse=True)
latest = infographics[0]

print(f"Downloading: {latest.get('title')}")
print(f"Created: {latest.get('created_at')}")

url = latest.get('infographic_url')
if not url:
    print("No URL available!")
    sys.exit(1)

# Download the image
response = requests.get(url)
if response.status_code == 200:
    # Save to current directory
    filename = f"infographic_{latest.get('artifact_id')[:8]}.png"
    with open(filename, 'wb') as f:
        f.write(response.content)
    print(f"Downloaded successfully: {filename}")
    print(f"Size: {len(response.content) / 1024:.1f} KB")
    print(f"Full path: {os.path.abspath(filename)}")
else:
    print(f"Download failed: HTTP {response.status_code}")
