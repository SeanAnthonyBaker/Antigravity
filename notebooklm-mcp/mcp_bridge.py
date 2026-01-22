import sys
import os
import json
import traceback
import argparse

# Add src to path so we can import notebooklm_mcp
current_dir = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(current_dir, 'src')
sys.path.append(src_path)

try:
    from notebooklm_mcp.server import get_client
except ImportError:
    print(json.dumps({"status": "error", "error": "Could not import notebooklm_mcp.server. Check python path."}))
    sys.exit(1)

def list_notebooks():
    try:
        client = get_client()
        notebooks = client.list_notebooks()
        
        # Serialize notebooks
        notebook_list = [
            {
                "id": nb.id,
                "title": nb.title,
                "source_count": nb.source_count,
                "url": nb.url,
                "ownership": nb.ownership,
                "is_shared": nb.is_shared,
                "created_at": nb.created_at,
                "modified_at": nb.modified_at,
            }
            for nb in notebooks
        ]
        
        return {"status": "success", "notebooks": notebook_list}
    except Exception as e:
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}

def query_notebook(notebook_id, query):
    try:
        client = get_client()
        # client.query returns a dict with 'answer', 'conversation_id', 'sources'
        result = client.query(notebook_id, query)
        
        if result:
            return {
                "status": "success", 
                "answer": result.get("answer", ""),
                "conversation_id": result.get("conversation_id"),
                "sources": result.get("sources", [])
            }
        else:
             return {"status": "error", "error": "No result returned from query"}

    except Exception as e:
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}

def create_artifact(data):
    try:
        client = get_client()
        nb_id = data.get('notebook_id')
        atype = data.get('artifact_type')
        
        # Get source IDs automatically
        sources = client.get_notebook_sources_with_types(nb_id)
        source_ids = [s["id"] for s in sources if s.get("id")]
        
        if not source_ids:
            return {"status": "error", "error": "No sources found in notebook"}

        if atype == 'infographic':
            result = client.create_infographic(
                notebook_id=nb_id,
                source_ids=source_ids,
                orientation_code=data.get('orientation', 1),
                detail_level_code=data.get('detail_level', 2),
                language=data.get('language', 'en'),
                focus_prompt=data.get('prompt', '')
            )
        elif atype == 'video':
            result = client.create_video_overview(
                notebook_id=nb_id,
                source_ids=source_ids,
                format_code=data.get('format_code', 1),
                visual_style_code=data.get('style_code', 1),
                language=data.get('language', 'en'),
                focus_prompt=data.get('prompt', '')
            )
        elif atype == 'audio':
            result = client.create_audio_overview(
                notebook_id=nb_id,
                source_ids=source_ids,
                format_code=data.get('format_code', 1),
                length_code=data.get('length_code', 2),
                language=data.get('language', 'en'),
                focus_prompt=data.get('prompt', '')
            )
        elif atype == 'slides':
            result = client.create_slide_deck(
                notebook_id=nb_id,
                source_ids=source_ids,
                format_code=data.get('format_code', 1),
                length_code=data.get('length_code', 2),
                language=data.get('language', 'en'),
                focus_prompt=data.get('prompt', '')
            )
        else:
            return {"status": "error", "error": f"Unknown artifact type: {atype}"}

        if result:
            return {"status": "success", "result": result}
        return {"status": "error", "error": f"Failed to create {atype}"}
    except Exception as e:
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}

def poll_status(nb_id):
    try:
        client = get_client()
        artifacts = client.poll_studio_status(nb_id)
        
        # Normalize artifacts for the frontend
        normalized = []
        for a in artifacts:
            # Map specific URL fields to generic 'url'
            url = a.get('infographic_url') or a.get('video_url') or a.get('audio_url') or a.get('slide_deck_url')
            
            normalized.append({
                "id": a.get('artifact_id'),
                "url": url,
                "status": a.get('status'),
                "title": a.get('title'),
                "type": a.get('type'),
                "created_at": a.get('created_at')
            })
            
        return {"status": "success", "artifacts": normalized}
    except Exception as e:
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}

def main():
    parser = argparse.ArgumentParser(description="Bridge to NotebookLM MCP")
    parser.add_argument('command', choices=['list', 'query', 'create', 'status'], nargs='?', help="Command to execute")
    parser.add_argument('--notebook_id', help="Notebook ID for query")
    parser.add_argument('--query', help="Query string")
    
    # If using stdin for args (safer for long queries):
    parser.add_argument('--json-input', action='store_true', help="Read arguments from JSON stdin")

    args = parser.parse_args()
    
    result = {"status": "error", "error": "Unknown command"}

    if args.json_input:
        try:
            input_data = json.load(sys.stdin)
            command = input_data.get('command')
            if command == 'list':
                result = list_notebooks()
            elif command == 'query':
                n_id = input_data.get('notebook_id')
                q_text = input_data.get('query')
                if not n_id or not q_text:
                     result = {"status": "error", "error": "Missing notebook_id or query in JSON input"}
                else:
                    result = query_notebook(n_id, q_text)
            elif command == 'create':
                result = create_artifact(input_data)
            elif command == 'status':
                n_id = input_data.get('notebook_id')
                if not n_id:
                     result = {"status": "error", "error": "Missing notebook_id"}
                else:
                    result = poll_status(n_id)
            else:
                result = {"status": "error", "error": f"Unknown command in JSON: {command}"}
        except json.JSONDecodeError:
             result = {"status": "error", "error": "Invalid JSON input"}
    else:
        # CLI args mode
        if args.command == 'list':
            result = list_notebooks()
        elif args.command == 'query':
            if not args.notebook_id or not args.query:
                result = {"status": "error", "error": "Missing --notebook_id or --query"}
            else:
                result = query_notebook(args.notebook_id, args.query)

    print(json.dumps(result))

if __name__ == "__main__":
    main()
