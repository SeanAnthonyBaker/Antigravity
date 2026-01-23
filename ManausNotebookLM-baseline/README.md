# ManausNotebookLM-baseline (Antigravity Backend)

This is the baseline implementation of the NotebookLM automation system for Antigravity. It provides a Flask-based API for orchestrating NotebookLM operations and managing artifact exports.

## Features

- **NotebookLM Automation**: Reverse-engineered API orchestration.
- **Artifact Export**: Logic for generating and saving NotebookLM studio artifacts.
- **Supabase Integration**: Middleware for persisting metadata and managing multi-tenant access.

## Tech Stack

- **Python 3.11+**
- **Flask**
- **httpx** (for API calls)
- **Supabase-py** (for database and storage)

## Development

Run the backend locally:

```bash
uv venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python app.py
```