import sys
sys.path.insert(0, 'src')
from notebooklm_mcp.api_client import NotebookLMClient
from notebooklm_mcp.auth import load_cached_tokens
import json

tokens = load_cached_tokens()
client = NotebookLMClient(cookies=tokens.cookies)
artifacts = client.poll_studio_status('637db15a-c0c3-4093-ba80-51202d1c89e3')

# Filter only infographics
infographics = [a for a in artifacts if a.get('type') == 'infographic']

print(f"Found {len(infographics)} infographics:")
print()
for i, inf in enumerate(infographics):
    print(f"{i+1}. {inf.get('title', 'Untitled')}")
    print(f"   Status: {inf.get('status')}")
    print(f"   Created: {inf.get('created_at')}")
    print(f"   ID: {inf.get('artifact_id')}")
    if inf.get('infographic_url'):
        print(f"   URL: {inf.get('infographic_url')[:80]}...")
    print()
