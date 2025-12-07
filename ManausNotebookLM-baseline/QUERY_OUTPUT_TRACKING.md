# NotebookLM Query Output Tracking Guide

This guide explains how to capture, track, and work with query responses from the NotebookLM automation API.

## Table of Contents
- [Understanding the Response Format](#understanding-the-response-format)
- [PowerShell Examples](#powershell-examples)
- [Python Examples](#python-examples)
- [Response Processing](#response-processing)
- [Troubleshooting](#troubleshooting)

---

## Understanding the Response Format

The API returns **Server-Sent Events (SSE)** in the following format:

```
data: {"status": "browser_ready", "message": "NotebookLM interface loaded."}
data: {"status": "waiting_for_response"}
data: {"status": "streaming"}
data: {"chunk": "First part of the response..."}
data: {"chunk": "More content..."}
data: {"chunk": "Final content..."}
data: {"status": "complete"}
data: {"status": "browser_closed"}
```

### Response Phases

1. **Initialization**
   ```json
   {"status": "browser_ready", "message": "NotebookLM interface loaded."}
   ```

2. **Waiting**
   ```json
   {"status": "waiting_for_response"}
   ```
   *(Note: "Thinking" phases are internally filtered and do not produce specific status messages)*

3. **Buffered Streaming** (multiple chunks)
   ```json
   {"status": "streaming"}
   {"chunk": "This is a substantial chunk of text..."}
   {"chunk": "...that has been buffered to ensure quality."}
   ```
   *(Note: Chunks are typically >10 words to prevent jitter)*

4. **Completion**
   ```json
   {"status": "complete"}
   {"status": "browser_closed"}
   ```

---

## PowerShell Examples

### Method 1: Simple Full Response Capture

```powershell
# Create request body
$body = @{
    query = "Summarize this notebook"
    notebooklm_url = "https://notebooklm.google.com/notebook/YOUR-NOTEBOOK-ID"
    timeout = 180
} | ConvertTo-Json

# Send request and capture full response
$response = Invoke-WebRequest `
    -Uri "http://136.114.0.39:5000/api/process_query" `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -TimeoutSec 200

# Save to file
$response.Content | Out-File -FilePath ".\response.txt" -Encoding UTF8
```

### Method 2: Extract Only Content Chunks

```powershell
# Get response
$body = '{"query":"What are the key points?","notebooklm_url":"https://notebooklm.google.com/notebook/YOUR-ID","timeout":180}'
$response = Invoke-WebRequest `
    -Uri "http://136.114.0.39:5000/api/process_query" `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -TimeoutSec 200

# Extract just the content chunks
$fullText = $response.Content -split "`n" | 
    Where-Object { $_ -match '"chunk":' } | 
    ForEach-Object {
        ($_ | ConvertFrom-Json).chunk
    } | 
    Out-String

# Display or save
Write-Host $fullText
$fullText | Out-File ".\answer.txt" -Encoding UTF8
```

### Method 3: Stream Response in Real-Time

```powershell
# Streaming display (shows content as it arrives)
$body = @{
    query = "Explain this in detail"
    notebooklm_url = "https://notebooklm.google.com/notebook/YOUR-ID"
    timeout = 180
} | ConvertTo-Json

$uri = "http://136.114.0.39:5000/api/process_query"
$request = [System.Net.HttpWebRequest]::Create($uri)
$request.Method = "POST"
$request.ContentType = "application/json"
$request.Timeout = 200000

# Send request
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$request.ContentLength = $bytes.Length
$requestStream = $request.GetRequestStream()
$requestStream.Write($bytes, 0, $bytes.Length)
$requestStream.Close()

# Read streaming response
$response = $request.GetResponse()
$reader = New-Object System.IO.StreamReader($response.GetResponseStream())

Write-Host "Response:" -ForegroundColor Green
$fullAnswer = ""

while (-not $reader.EndOfStream) {
    $line = $reader.ReadLine()
    if ($line -match '^data: (.+)$') {
        $data = $matches[1] | ConvertFrom-Json
        if ($data.chunk) {
            Write-Host $data.chunk -NoNewline
            $fullAnswer += $data.chunk
        }
        elseif ($data.status) {
            Write-Host "`n[$($data.status)]" -ForegroundColor Yellow
        }
    }
}
$reader.Close()

# Save complete answer
$fullAnswer | Out-File ".\complete_answer.txt" -Encoding UTF8
```

---

## Python Examples

### Method 1: Simple Request

```python
import requests
import json

# API endpoint
url = "http://136.114.0.39:5000/api/process_query"

# Request payload
payload = {
    "query": "Summarize this notebook",
    "notebooklm_url": "https://notebooklm.google.com/notebook/YOUR-ID",
    "timeout": 180
}

# Send request
response = requests.post(url, json=payload, timeout=200)

# Save full response
with open("response.txt", "w", encoding="utf-8") as f:
    f.write(response.text)

print("Response saved to response.txt")
```

### Method 2: Extract Content Chunks

```python
import requests
import json
import re

url = "http://136.114.0.39:5000/api/process_query"
payload = {
    "query": "What are the main topics?",
    "notebooklm_url": "https://notebooklm.google.com/notebook/YOUR-ID",
    "timeout": 180
}

response = requests.post(url, json=payload, timeout=200)

# Extract only content chunks
chunks = []
for line in response.text.split('\n'):
    if line.startswith('data: {'):
        try:
            data = json.loads(line[6:])  # Remove 'data: ' prefix
            if 'chunk' in data:
                chunks.append(data['chunk'])
        except json.JSONDecodeError:
            continue

# Combine into full answer
full_answer = ''.join(chunks)

# Save
with open("answer.txt", "w", encoding="utf-8") as f:
    f.write(full_answer)

print(f"Answer extracted: {len(full_answer)} characters")
print(full_answer[:200] + "...")  # Preview first 200 chars
```

### Method 3: Stream and Display Real-Time

```python
import requests
import json

url = "http://136.114.0.39:5000/api/process_query"
payload = {
    "query": "Provide a detailed analysis",
    "notebooklm_url": "https://notebooklm.google.com/notebook/YOUR-ID",
    "timeout": 180
}

# Stream response
response = requests.post(url, json=payload, stream=True, timeout=200)

print("Response:\n" + "="*80)
full_answer = ""

for line in response.iter_lines(decode_unicode=True):
    if line and line.startswith('data: '):
        try:
            data = json.loads(line[6:])
            if 'chunk' in data:
                print(data['chunk'], end='', flush=True)
                full_answer += data['chunk']
            elif 'status' in data:
                print(f"\n[{data['status']}]")
        except json.JSONDecodeError:
            continue

print("\n" + "="*80)

# Save complete answer
with open("complete_answer.txt", "w", encoding="utf-8") as f:
    f.write(full_answer)

print(f"\nComplete answer saved ({len(full_answer)} chars)")
```

---

## Response Processing

### Parsing Server-Sent Events

Each line in the response follows this pattern:

```
data: <JSON_OBJECT>
```

**Status Messages:**
- `browser_ready` - Browser initialized
- `waiting_for_response` - Query submitted, waiting for NotebookLM
- `streaming` - Response is being generated
- `complete` - Response finished successfully
- `browser_closed` - Session cleaned up

**Content Messages:**
- `chunk` - Contains a piece of the response text

### Combining Chunks

```powershell
# PowerShell: Combine all chunks into single text
$fullText = ($response.Content -split "`n" | 
    Where-Object { $_ -match '"chunk":' } | 
    ForEach-Object { ($_ | ConvertFrom-Json).chunk }) -join ''
```

```python
# Python: Combine all chunks
chunks = [
    json.loads(line[6:])['chunk'] 
    for line in response.text.split('\n') 
    if line.startswith('data: ') and '"chunk"' in line
]
full_text = ''.join(chunks)
```

---

## Troubleshooting

### Issue: Response Appears Truncated

**Cause:** PowerShell console truncates long output

**Solution:** Save to file instead of displaying
```powershell
$response.Content | Out-File "response.txt" -Encoding UTF8
```

### Issue: Missing First Chunks

**Cause:** Console buffer limitation or display truncation

**Solution:** Use file-based capture:
```powershell
$fullText = $response.Content -split "`n" | 
    Where-Object { $_ -match '"chunk":' } | 
    ForEach-Object { ($_ | ConvertFrom-Json).chunk } | 
    Out-String

$fullText | Out-File "complete.txt" -Encoding UTF8
```

### Issue: Timeout Errors

**Cause:** Response taking longer than timeout setting

**Solution:** Increase timeout:
```powershell
# Increase TimeoutSec
Invoke-WebRequest ... -TimeoutSec 300  # 5 minutes
```

```python
# Increase timeout
requests.post(url, json=payload, timeout=300)
```

### Issue: Connection Refused

**Cause:** Server not running or network issue

**Solution:** Check server status:
```powershell
curl.exe http://136.114.0.39:5000/api/status
```

---

## Best Practices

1. **Always Save to File** for important queries
2. **Use Unicode/UTF-8 Encoding** to preserve special characters
3. **Set Appropriate Timeouts** (typical queries: 120-180 seconds)
4. **Handle Errors Gracefully** with try-catch blocks
5. **Monitor Server Logs** for debugging

### Example: Production-Ready Capture

```powershell
# Robust query capture with error handling
try {
    $body = @{
        query = "Your question here"
        notebooklm_url = "https://notebooklm.google.com/notebook/YOUR-ID"
        timeout = 180
    } | ConvertTo-Json

    Write-Host "Sending query..." -ForegroundColor Cyan
    $response = Invoke-WebRequest `
        -Uri "http://136.114.0.39:5000/api/process_query" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 200

    # Extract content
    $content = $response.Content -split "`n" | 
        Where-Object { $_ -match '"chunk":' } | 
        ForEach-Object { ($_ | ConvertFrom-Json).chunk } | 
        Out-String

    # Save with timestamp
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $filename = "query_response_$timestamp.txt"
    $content | Out-File $filename -Encoding UTF8

    Write-Host "✓ Response saved to $filename" -ForegroundColor Green
    Write-Host "  Length: $($content.Length) characters" -ForegroundColor Gray
}
catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
```

---

## API Reference

### Endpoint
```
POST http://136.114.0.39:5000/api/process_query
```

### Request Body
```json
{
    "query": "string (required) - Your question",
    "notebooklm_url": "string (required) - Full NotebookLM URL",
    "timeout": "integer (optional, default: 180) - Max seconds to wait"
}
```

### Response Format
Server-Sent Events (text/event-stream)

### Status Codes
- `200` - Success (streaming response)
- `400` - Bad request (missing parameters)
- `500` - Server error

---

## Summary

**Quick Start:**
```powershell
# Simplest way to capture a response
$response = Invoke-WebRequest -Uri "http://136.114.0.39:5000/api/process_query" -Method POST -Body '{"query":"Your question","notebooklm_url":"YOUR-URL","timeout":180}' -ContentType "application/json" -TimeoutSec 200
($response.Content -split "`n" | Where-Object { $_ -match '"chunk":' } | ForEach-Object { ($_ | ConvertFrom-Json).chunk }) -join '' | Out-File answer.txt
```

For more advanced usage, refer to the specific examples above.
