import sys
sys.path.insert(0, 'src')
from notebooklm_mcp.api_client import NotebookLMClient
from notebooklm_mcp.auth import load_cached_tokens
import json

tokens = load_cached_tokens()
client = NotebookLMClient(cookies=tokens.cookies)
artifacts = client.poll_studio_status('637db15a-c0c3-4093-ba80-51202d1c89e3')

print("Studio Status:")
print(json.dumps(artifacts, indent=2))
