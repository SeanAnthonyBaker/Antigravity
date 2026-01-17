print("Starting debug script")
import sys
print(f"Python: {sys.version}")
print(f"Path: {sys.path}")
try:
    import notebooklm_mcp
    print(f"Imported notebooklm_mcp from {notebooklm_mcp.__file__}")
except Exception as e:
    print(f"Import error: {e}")
print("End debug script")
