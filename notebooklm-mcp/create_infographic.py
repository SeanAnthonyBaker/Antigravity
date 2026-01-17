import sys
import os
import json

# Log to file directly
log_path = os.path.join(os.getcwd(), "infographic_run.log")
log_file = open(log_path, "w", encoding='utf-8', buffering=1)
sys.stdout = log_file
sys.stderr = log_file

print("Starting infographic creation...")

try:
    sys.path.insert(0, os.path.join(os.getcwd(), "src"))
    
    from notebooklm_mcp.api_client import NotebookLMClient
    from notebooklm_mcp.auth import load_cached_tokens
    print("Import successful.")

    print("Loading cached auth tokens...")
    tokens = load_cached_tokens()
    if not tokens:
        print("No cached tokens found! Run 'notebooklm-mcp-auth' first.")
        sys.exit(1)
    
    print(f"Loaded tokens: {len(tokens.cookies)} cookies")
    
    print("Initializing client...")
    client = NotebookLMClient(cookies=tokens.cookies)
    print("Client initialized successfully.")

    target_title = "Siemens Energy Address Library Harmonization and Governance"
    print(f"Searching for notebook: '{target_title}'...")
    
    notebooks = client.list_notebooks()
    target_notebook = next((nb for nb in notebooks if nb.title == target_title), None)

    if not target_notebook:
        print(f"Notebook not found. Available notebooks ({len(notebooks)}):")
        for nb in notebooks:
            print(f"- {nb.title}")
        sys.exit(1)

    print(f"Found notebook: {target_notebook.id}")

    # Get source IDs
    sources = client.get_notebook_sources_with_types(target_notebook.id)
    source_ids = [s["id"] for s in sources if s["id"]]
    
    if not source_ids:
        print("No sources found!")
        sys.exit(1)
        
    print(f"Using {len(source_ids)} sources.")

    # Create infographic showing next 3 months plan - one column per month
    focus_prompt = """Create a detailed infographic showing the NEXT 3 MONTHS PLAN for the Address Library Harmonization project at Siemens Energy:

Use a THREE COLUMN LAYOUT - one column for each month:

COLUMN 1 - FEBRUARY 2026:
- Key activities and deliverables planned for February
- Sprint goals and milestones
- Team focus areas
- Dependencies and blockers to address

COLUMN 2 - MARCH 2026:
- Key activities and deliverables planned for March
- Sprint goals and milestones
- Team focus areas
- Integration and testing phases

COLUMN 3 - APRIL 2026:
- Key activities and deliverables planned for April
- Sprint goals and milestones
- Go-live preparation
- Training and change management activities

Include visual indicators for progress tracking and key decision points.
"""

    print("Creating infographic (detailed, landscape, English) - 3 Month Plan...")
    
    # Create infographic
    # orientation: 1=landscape, 2=portrait, 3=square
    # detail_level: 1=concise, 2=standard, 3=detailed
    result = client.create_infographic(
        notebook_id=target_notebook.id,
        source_ids=source_ids,
        orientation_code=1,  # landscape for 3 column layout
        detail_level_code=3,  # detailed
        language="en",  # English
        focus_prompt=focus_prompt
    )
    
    if result:
        print("Infographic creation started!")
        print(f"Artifact ID: {result.get('artifact_id')}")
        print(f"Status: {result.get('status')}")
        print(f"Result: {json.dumps(result, indent=2)}")
    else:
        print("Failed to create infographic")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    print("Script finished.")
    log_file.close()
