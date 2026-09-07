"""
Access Microsoft Project for the web via Dataverse API
Retrieves projects and tasks from your Tulkah.AI 6 Week Value Roadmap
"""

import requests
import msal
import json

# Configuration
TENANT_ID = "2bec83ec-133e-4dff-b5e4-45045d92b1c8"
CLIENT_ID = "c88b1b1d-bd08-4007-be32-50d17e06f2a8"
DATAVERSE_URL = "https://org54ad8b05ea0bef119f85002248c656a2.crm.dynamics.com"
PROJECT_ID = "fe864a34-8a67-4ed4-bdaf-806faaccc9c3"

# Authentication scope
SCOPE = [f"{DATAVERSE_URL}/user_impersonation"]

def get_access_token():
    """Get access token via interactive browser login"""
    print("🔐 Authenticating with Microsoft...")
    
    app = msal.PublicClientApplication(
        CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{TENANT_ID}"
    )
    
    # Try to get token interactively
    result = app.acquire_token_interactive(scopes=SCOPE)
    
    if "access_token" in result:
        print("✅ Authentication successful!\n")
        return result["access_token"]
    else:
        print(f"❌ Authentication failed: {result.get('error_description')}")
        return None

def get_projects(token):
    """Retrieve all projects"""
    print("📋 Fetching all projects...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
    }
    
    url = f"{DATAVERSE_URL}/api/data/v9.2/msdyn_projects"
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        projects = response.json()
        print(f"✅ Found {len(projects['value'])} project(s):\n")
        
        for project in projects['value']:
            print(f"  📌 {project.get('msdyn_subject', 'Untitled')}")
            print(f"     ID: {project.get('msdyn_projectid')}")
            print(f"     Created: {project.get('createdon', 'N/A')}\n")
        
        return projects['value']
    else:
        print(f"❌ Error {response.status_code}: {response.text}")
        return []

def get_project_tasks(token, project_id):
    """Retrieve tasks for a specific project"""
    print(f"📝 Fetching tasks for project {project_id}...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
    }
    
    # Filter tasks by project ID
    filter_query = f"_msdyn_project_value eq {project_id}"
    url = f"{DATAVERSE_URL}/api/data/v9.2/msdyn_projecttasks?$filter={filter_query}&$orderby=msdyn_scheduledstart asc"
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        tasks = response.json()
        print(f"✅ Found {len(tasks['value'])} task(s):\n")
        
        for task in tasks['value']:
            progress = task.get('msdyn_progress', 0)
            status_icon = "✅" if progress == 100 else "🔄" if progress > 0 else "⏳"
            
            print(f"{status_icon} {task.get('msdyn_subject', 'Untitled Task')}")
            print(f"   Progress: {progress}%")
            
            if task.get('msdyn_scheduledstart'):
                print(f"   Start: {task['msdyn_scheduledstart']}")
            if task.get('msdyn_scheduledend'):
                print(f"   End: {task['msdyn_scheduledend']}")
            print()
        
        return tasks['value']
    else:
        print(f"❌ Error {response.status_code}: {response.text}")
        return []

def save_to_json(projects, tasks, filename="project_data.json"):
    """Save data to JSON file"""
    data = {
        "projects": projects,
        "tasks": tasks
    }
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"💾 Data saved to: {filename}")

def main():
    """Main execution"""
    print("=" * 60)
    print("Microsoft Project for the web - Dataverse API Access")
    print("=" * 60)
    print()
    
    # Step 1: Authenticate
    token = get_access_token()
    if not token:
        return
    
    # Step 2: Get all projects
    projects = get_projects(token)
    
    # Step 3: Get tasks for your specific project
    if projects:
        tasks = get_project_tasks(token, PROJECT_ID)
        
        # Step 4: Save to JSON
        save_to_json(projects, tasks)
        
        print()
        print("=" * 60)
        print("🎉 Success! Your Project for the web data is accessible!")
        print("=" * 60)
    else:
        print("No projects found or error occurred.")

if __name__ == "__main__":
    main()
