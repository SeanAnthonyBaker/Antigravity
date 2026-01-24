# NLM CLI Research Findings

## Available Commands

✅ **All needed operations are supported by nlm CLI**

### Notebook Operations
```bash
# List notebooks
nlm notebook list --json

# Get notebook details
nlm notebook get <notebook-id> --json

# Create notebook
nlm notebook create "Title" --json

# Delete notebook
nlm notebook delete <notebook-id>
```

### Artifact Creation
All artifact types have dedicated create commands:

```bash
# Audio Overview (Podcast)
nlm audio create <notebook-id> \\
    --format deep_dive \\
    --length default \\
    --language en \\
    --focus "topic"

# Video Overview
nlm video create <notebook-id> --focus "topic"

# Infographic
nlm infographic create <notebook-id> --focus "topic"

# Slide Deck  
nlm slides create <notebook-id> --focus "topic"

# Mind Map
nlm mindmap create <notebook-id>

# Report
nlm report create <notebook-id> --format "Briefing Doc"

# Quiz
nlm quiz create <notebook-id>

# Flashcards
nlm flashcards create <notebook-id>

# Data Table
nlm data-table create <notebook-id> --description "desc"
```

### Source Management
```bash
# List sources
nlm source list <notebook-id> --json

# Add source (URL, upload, etc.)
nlm source add <notebook-id> --url <url>
```

## JSON Output Support

✅ **Confirmed:** `notebook list` supports `--json` flag
❓ **Needs Verification:** Other commands may not have `--json` flag explicitly listed

### Fallback Strategy
If artifact creation commands don't support `--json`:
1. Parse console output (tables/rich text)
2. Use `notebook get` afterward to retrieve artifact details
3. Poll for completion status

## Command Mapping for Backend

| Backend Endpoint | Current (Python lib) | New (nlm CLI) |
|-----------------|---------------------|---------------|
| `/api/mcp/notebooks` | `client.list_notebooks()` | `nlm notebook list --json` |
| `/api/mcp/generate_artifact` (audio) | `client.create_audio_overview()` | `nlm audio create <id>` |
| `/api/mcp/generate_artifact` (video) | `client.create_video_overview()` | `nlm video create <id>` |
| `/api/mcp/generate_artifact` (infographic) | `client.create_infographic()` | `nlm infographic create <id>` |
| `/api/mcp/generate_artifact` (mind_map) | `client.generate_mind_map()` + `client.save_mind_map()` | `nlm mindmap create <id>` |
| `/api/mcp/status/<id>` | `client.poll_studio_status()` | `nlm notebook get <id> --json` (parse artifacts) |

## Implementation Notes

### 1. Subprocess Execution
```python
import subprocess
import json

def run_nlm_command(args: list[str]) -> dict:
    result = subprocess.run(
        ['nlm'] + args,
        capture_output=True,
        text=True,
        check=True
    )
    if '--json' in args:
        return json.loads(result.stdout)
    return {"stdout": result.stdout, "stderr": result.stderr}
```

### 2.Error Handling
- Non-zero exit codes indicate failures
- Stderr contains error messages
- Need to wrap in try/except for subprocess.CalledProcessError

### 3. Status Polling
Since artifact creation may be async:
- Create command starts the task
- Use `nlm notebook get <id> --json` to poll for completion
- Parse the artifacts array from response

## Next Steps

1. **Test JSON output** for all commands
2. **Verify polling mechanism** - how to check artifact status
3. **Handle async operations** - determine if create commands block or return immediately
4. **Test in container** - ensure nlm works in Docker environment
