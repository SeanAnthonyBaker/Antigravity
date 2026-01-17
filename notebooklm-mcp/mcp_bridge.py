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

def main():
    parser = argparse.ArgumentParser(description="Bridge to NotebookLM MCP")
    parser.add_argument('command', choices=['list', 'query'], nargs='?', help="Command to execute")
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
