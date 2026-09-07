from notebooklm_mcp.api_client import NotebookLMClient
from notebooklm_mcp.auth import load_cached_tokens
import json
import asyncio

NOTEBOOK_ID = "b554f156-f548-4adb-97c6-ff4433e285b7"
KEYWORD = "MCP"

async def main():
    print("Loading auth tokens...")
    try:
        tokens = load_cached_tokens()
    except Exception as e:
        print(f"Failed to load tokens: {e}")
        return

    # Try different instantiation patterns if needed.
    # Assuming cookies str or dict.
    if not tokens:
        print("No tokens found. Run 'nlm login' or use authentication tool.")
        return

    print("Initializing client...")
    # Based on common patterns and auth keys
    cookies = tokens.get('cookies')
    if not cookies:
        print("No cookies in token data")
        return

    # Check signature via help if this fails, but let's try assuming headers or cookies
    # If NotebookLMClient takes (cookies=...)
    try:
        client = NotebookLMClient(cookies=cookies)
    except TypeError:
        # Maybe it takes headers?
        try:
            client = NotebookLMClient(headers={"Cookie": cookies})
        except TypeError:
             print("Could not instantiate NotebookLMClient. Inspect signature:")
             import inspect
             print(inspect.signature(NotebookLMClient.__init__))
             return

    print(f"Fetching notebook {NOTEBOOK_ID}...")
    try:
        # Assuming get_notebook(id) or similar.
        # Check methods
        if hasattr(client, 'getLocation'): # Internal method
             pass
        
        # Most likely 'get_notebook' or 'list_sources'
        # The CLI 'notebook get' maps to something.
        # Let's inspect methods.
        methods = [m for m in dir(client) if not m.startswith('_')]
        # print(f"Client methods: {methods}")
        
        if 'get_notebook' in methods:
            nb = await client.get_notebook(NOTEBOOK_ID)
        else:
             print(f"Method 'get_notebook' not found. Available: {methods}")
             return

        sources = nb.get('sources', [])
        print(f"Found {len(sources)} sources.")
        
        matches = [s for s in sources if KEYWORD.lower() in s.get('title', '').lower()]
        
        print(f"\nSources containing '{KEYWORD}':")
        for s in matches:
            print(f"- [{s['id']}] {s['title']}")
            
    except Exception as e:
        print(f"Error fetching notebook: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
