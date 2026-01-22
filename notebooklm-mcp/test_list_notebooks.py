#!/usr/bin/env python3
"""Quick test script to list notebooks"""
import asyncio
from notebooklm_mcp.api_client import NotebookLMClient

def main():
    from notebooklm_mcp.auth import load_cached_tokens
    tokens = load_cached_tokens()
    if not tokens:
        print("No cached tokens found! Run 'notebooklm-mcp-auth' first.")
        return

    client = NotebookLMClient(cookies=tokens.cookies)
    try:
        notebooks = client.list_notebooks()
        print("=== Notebooks ===")
        for nb in notebooks:
            print(f"- {nb.title} (ID: {nb.id})")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
