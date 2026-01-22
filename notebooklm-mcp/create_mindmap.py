import sys
import os
import json

# Log to file directly
log_path = os.path.join(os.getcwd(), "mindmap_run.log")
log_file = open(log_path, "w", encoding='utf-8', buffering=1)
sys.stdout = log_file
sys.stderr = log_file

print("Starting mind map creation...")

    # Ensure we can import from src
    sys.path.insert(0, os.path.join(os.getcwd(), "src"))
    
    from notebooklm_mcp.api_client import NotebookLMClient
    from notebooklm_mcp.auth import load_cached_tokens
    print("Import successful.")

    print("Loading cached auth tokens...")
    tokens = load_cached_tokens()
    if not tokens:
        print("No cached tokens found! Run 'notebooklm-mcp-auth' first.")
        sys.exit(1)
    
    print(f"Loaded {len(tokens.cookies)} cookies.")
    
    print("Initializing client...")
    client = NotebookLMClient(cookies=tokens.cookies)
    print("Client initialized successfully.")

    target_title = "Mastering the NotebookLM MCP Server: 31 Tools for Integration"
    print(f"Searching for notebook: '{target_title}'...")
    
    try:
        notebooks = client.list_notebooks()
    except Exception as e:
        print(f"Failed to list notebooks: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    target_notebook = next((nb for nb in notebooks if nb.title == target_title), None)

    if not target_notebook:
        print(f"Notebook not found. Available notebooks ({len(notebooks)}):")
        for nb in notebooks:
            print(f"- {nb.title}")
        sys.exit(1)

    print(f"Found notebook: {target_notebook.id}")

    # Get source IDs
    print("Getting sources...")
    sources = client.get_notebook_sources_with_types(target_notebook.id)
    source_ids = [s["id"] for s in sources if s["id"]]
    
    if not source_ids:
        print("No sources found in notebook!")
        sys.exit(1)
        
    print(f"Using {len(source_ids)} sources: {source_ids}")

    # Step 1: Generate the mind map
    print("Generating mind map (this may take a moment)...")
    try:
        gen_result = client.generate_mind_map(source_ids=source_ids)
        if not gen_result:
            print("Failed to generate mind map - no result returned")
            sys.exit(1)
            
        print(f"Mind map generated!")
        print(f"Generation ID: {gen_result.get('generation_id')}")
        
        mind_map_json = gen_result.get('mind_map_json')
        if not mind_map_json:
            print("No mind map JSON in result!")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error generating mind map: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # Step 2: Save the mind map to the notebook
    print("Saving mind map to notebook...")
    try:
        save_result = client.save_mind_map(
            notebook_id=target_notebook.id,
            mind_map_json=mind_map_json,
            source_ids=source_ids,
            title="Detailed Mind Map - NotebookLM MCP Server"
        )
        
        if save_result:
            print(f"Mind map saved successfully!")
            print(f"Mind Map ID: {save_result.get('mind_map_id')}")
            print(f"Title: {save_result.get('title')}")
        else:
            print("Failed to save mind map")
            
    except Exception as e:
        print(f"Error saving mind map: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # Save the mind map JSON to a file for download
    output_path = os.path.join(os.getcwd(), "mindmap_output.json")
    with open(output_path, "w", encoding="utf-8") as f:
        # Try to parse and pretty-print
        try:
            parsed_json = json.loads(mind_map_json)
            json.dump(parsed_json, f, indent=2)
        except:
            f.write(mind_map_json)
    print(f"Mind map JSON saved to: {output_path}")

    print("SUCCESS! Mind map created and saved.")

except Exception as outer_e:
    print(f"Outer error: {outer_e}")
    import traceback
    traceback.print_exc()
finally:
    print("Script finished.")
    log_file.close()
