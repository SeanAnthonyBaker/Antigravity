# Quick Start Guide - Project for the Web API

## How to Run

### 1. Start the Flask Backend

```bash
cd c:\Users\seanb\Tulkah.AI\Antigravity\ManausNotebookLM-baseline
python main.py
```

The server will start on **http://localhost:5000**

### 2. Ensure M365 CLI is Authenticated

```bash
m365 status
# If not logged in:
m365 login --authType browser
```

### 3. Test the API

**Health Check:**
```bash
curl http://localhost:5000/api/project/health
```

**Get All Projects:**
```bash
curl http://localhost:5000/api/project/list
```

**Get Project Tasks:**
```bash
curl http://localhost:5000/api/project/fe864a34-8a67-4ed4-bdaf-806faaccc9c3/tasks
```

**Create a Task:**
```bash
curl -X POST http://localhost:5000/api/project/task \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "fe864a34-8a67-4ed4-bdaf-806faaccc9c3",
    "subject": "Test Task from API",
    "description": "Created via Flask backend",
    "progress": 0
  }'
```

### 4. Use from Frontend (JavaScript)

```javascript
// Get project tasks
async function getProjectTasks() {
    const response = await fetch('/api/project/fe864a34-8a67-4ed4-bdaf-806faaccc9c3/tasks');
    const data = await response.json();
    console.log(data.value); // Array of tasks
}

// Create a new task
async function createTask(taskData) {
    const response = await fetch('/api/project/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            project_id: 'fe864a34-8a67-4ed4-bdaf-806faaccc9c3',
            subject: taskData.title,
            description: taskData.description,
            progress: 0
        })
    });
    return await response.json();
}

// Update a task
async function updateTask(taskId, updates) {
    const response = await fetch(`/api/project/task/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            progress: updates.progress,
            subject: updates.title
        })
    });
    return await response.json();
}
```

## Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/project/health` | Check API status |
| GET | `/api/project/list` | Get all projects |
| GET | `/api/project/<id>` | Get specific project |
| GET | `/api/project/<id>/tasks` | Get project tasks |
| POST | `/api/project/task` | Create new task |
| PATCH | `/api/project/task/<id>` | Update task |
| DELETE | `/api/project/task/<id>` | Delete task |

## Troubleshooting

**Error: "M365 CLI authentication failed"**
```bash
m365 logout
m365 login --authType browser
```

**Error: "Module not found: requests"**
```bash
pip install requests
```

**Server not starting:**
- Check if port 5000 is already in use
- Verify Python is installed: `python --version`

**CORS errors from frontend:**
- The backend is configured to allow CORS in development mode
- For production, ensure Caddy handles CORS

## Next Steps

1. ✅ Backend is running
2. ✅ M365 CLI authenticated
3. ✅ Test endpoints with curl
4. Integrate with Antigravity frontend
5. Deploy to production (GCP)

**You now have full programmatic access to Microsoft Project for the web!** 🎉
