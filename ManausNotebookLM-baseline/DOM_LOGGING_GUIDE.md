# NotebookLM DOM Logging Guide

## Overview

Your NotebookLM automation now includes comprehensive DOM logging at three critical stages during query processing.

## What Was Added

### 1. **Before Query Entry** (Already Existed)
- Captures DOM snapshot before any query is submitted
- Logs the number of response elements present

### 2. **During Chunk Retrieval** (NEW ✨)
- Captures DOM snapshots **every 3 seconds** during streaming
- Logs detailed information about new elements as they appear
- Tracks "thinking" indicators and loading states

**Logged Information:**
- Total response element count
- New elements since query started
- Element attributes (class, aria-busy, text content)
- Loading indicators (`[aria-busy="true"]`)
- "Thinking" phrase elements (e.g., "Sifting through pages...")

### 3. **After Query Completion** (Already Existed)
- Final DOM snapshot after response is complete
- Comparison with initial state
- Identification of all new elements

## Deployment Status

✅ **Successfully Deployed!**

Both files have been deployed to your Google Cloud VM:
- `notebooklm.py` - Updated with DOM logging during streaming
- `main.py` - Updated with file-based logging configuration

The Docker container has been restarted and changes are now live.

## Accessing the Logs

### Method 1: Docker Logs (Recommended for Now)

View real-time logs from the container:
```powershell
gcloud compute ssh notebooklm-backend-vm --zone=us-central1-a --command="sudo docker logs notebooklm-backend-app-1 -f"
```

View last 100 lines:
```powershell
gcloud compute ssh notebooklm-backend-vm --zone=us-central1-a --command="sudo docker logs notebooklm-backend-app-1 --tail 100"
```

### Method 2: Search for DOM Snapshots

Find all DOM snapshot logs:
```powershell
gcloud compute ssh notebooklm-backend-vm --zone=us-central1-a --command="sudo docker logs notebooklm-backend-app-1 2>&1 | grep 'DOM SNAPSHOT'"
```

Find streaming snapshots:
```powershell
gcloud compute ssh notebooklm-backend-vm --zone=us-central1-a --command="sudo docker logs notebooklm-backend-app-1 2>&1 | grep 'DURING STREAMING'"
```

### Method 3: File-Based Logs (Requires Volume Mount)

The code is configured to write logs to `/logs/notebooklm.log`, but this requires a Docker volume mount to persist. To enable this, you would need to update `docker-compose.yml` to add:

```yaml
volumes:
  - ./logs:/logs
```

## Log Output Example

When a query is processed, you'll see output like this:

```
================================================================================
DOM SNAPSHOT DURING STREAMING #1:
  Response elements count: 2
  New elements since start: 1
  NEW elements detected during streaming:
    [1] Length: 156 chars
         Class: message-content response-text
         Preview: The key findings from the document are...
         aria-busy: None
  Loading indicators found: 0
  'Thinking' phrase elements found: 1
    - Text: Sifting through pages...
================================================================================
```

## Configuration

You can adjust these parameters in `notebooklm.py`:

```python
DOM_SNAPSHOT_INTERVAL = 3  # Take a snapshot every 3 seconds (line 348)
```

## Next Steps

To enable persistent file-based logging:

1. Update `docker-compose.yml` to mount a logs volume
2. Ensure the `/logs` directory is created in the container
3. Redeploy the application

The logs will automatically rotate when they reach 10MB and keep 5 backup files.

## Troubleshooting

If you don't see DOM snapshots in the logs:
1. Make sure you're processing a query (the snapshots only appear during active queries)
2. Check that the streaming phase is lasting longer than 3 seconds
3. Verify the container restarted successfully after deployment

---

**Deployment completed:** 2025-12-06 22:58 UTC
