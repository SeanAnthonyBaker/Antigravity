#!/usr/bin/env python3
"""Quick test script to list notebooks"""
import asyncio
from notebooklm_mcp.api_client import NotebookLMClient

async def main():
    client = NotebookLMClient()
    try:
        notebooks = await client.list_notebooks()
        print("=== Notebooks ===")
        for nb in notebooks:
            print(f"- {nb.get('title', 'Untitled')} (ID: {nb.get('id', 'N/A')})")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
