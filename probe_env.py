from notebooklm_mcp.api_client import NotebookLMClient
import notebooklm_mcp.auth as auth
import inspect

print("--- NotebookLMClient.__init__ ---")
try:
    print(inspect.signature(NotebookLMClient.__init__))
except Exception as e:
    print(e)

print("\n--- auth module ---")
print(dir(auth))
if hasattr(auth, 'load_auth_from_file'):
    print(inspect.signature(auth.load_auth_from_file))
if hasattr(auth, 'load_tokens_from_file'):
     print("load_tokens_from_file found")
     print(inspect.signature(auth.load_tokens_from_file))
