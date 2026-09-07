# project_api.py - Flask Blueprint for Project for the Web API Access

from flask import Blueprint, jsonify, request
import subprocess
import requests
import logging

logger = logging.getLogger(__name__)

project_bp = Blueprint('project', __name__)

DATAVERSE_URL = "https://org54ad8b05ea0bef119f85002248c656a2.crm.dynamics.com"
PROJECT_ID = "fe864a34-8a67-4ed4-bdaf-806faaccc9c3"

def get_m365_token(resource):
    """Get access token using M365 CLI (browser auth)"""
    try:
        cmd = f"m365 util accesstoken get --resource {resource} --output text"
        token = subprocess.check_output(cmd, shell=True, text=True).strip()
        return token
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to get M365 token: {e}")
        raise Exception("M365 CLI authentication failed. Run: m365 login --authType browser")

def make_dataverse_request(method, endpoint, data=None):
    """Make authenticated request to Dataverse API"""
    token = get_m365_token(DATAVERSE_URL)
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    }
    
    url = f'{DATAVERSE_URL}/api/data/v9.2/{endpoint}'
    
    if method == 'GET':
        response = requests.get(url, headers=headers)
    elif method == 'POST':
        response = requests.post(url, headers=headers, json=data)
    elif method == 'PATCH':
        response = requests.patch(url, headers=headers, json=data)
    elif method == 'DELETE':
        response = requests.delete(url, headers=headers)
    else:
        raise ValueError(f"Unsupported method: {method}")
    
    response.raise_for_status()
    return response.json() if response.text else {}

@project_bp.route('/api/project/list', methods=['GET'])
def list_projects():
    """Get all projects from Dataverse"""
    try:
        data = make_dataverse_request('GET', 'msdyn_projects')
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        return jsonify({'error': str(e)}), 500

@project_bp.route('/api/project/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get specific project details"""
    try:
        data = make_dataverse_request('GET', f'msdyn_projects({project_id})')
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error getting project: {e}")
        return jsonify({'error': str(e)}), 500

@project_bp.route('/api/project/<project_id>/tasks', methods=['GET'])
def get_project_tasks(project_id):
    """Get tasks for a specific project"""
    try:
        filter_query = f"_msdyn_project_value eq {project_id}"
        endpoint = f"msdyn_projecttasks?$filter={filter_query}&$orderby=msdyn_scheduledstart asc"
        data = make_dataverse_request('GET', endpoint)
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error getting tasks: {e}")
        return jsonify({'error': str(e)}), 500

@project_bp.route('/api/project/task', methods=['POST'])
def create_task():
    """Create a new task in a project"""
    try:
        data = request.json
        
        # Validate required fields
        if not data.get('project_id') or not data.get('subject'):
            return jsonify({'error': 'project_id and subject are required'}), 400
        
        payload = {
            'msdyn_subject': data['subject'],
            'msdyn_description': data.get('description', ''),
            'msdyn_progress': data.get('progress', 0),
            'msdyn_project@odata.bind': f"/msdyn_projects({data['project_id']})"
        }
        
        if data.get('start_date'):
            payload['msdyn_scheduledstart'] = data['start_date']
        if data.get('end_date'):
            payload['msdyn_scheduledend'] = data['end_date']
        
        result = make_dataverse_request('POST', 'msdyn_projecttasks', payload)
        return jsonify(result), 201
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        return jsonify({'error': str(e)}), 500

@project_bp.route('/api/project/task/<task_id>', methods=['PATCH'])
def update_task(task_id):
    """Update an existing task"""
    try:
        data = request.json
        
        # Build update payload (only include provided fields)
        payload = {}
        if 'subject' in data:
            payload['msdyn_subject'] = data['subject']
        if 'description' in data:
            payload['msdyn_description'] = data['description']
        if 'progress' in data:
            payload['msdyn_progress'] = data['progress']
        if 'start_date' in data:
            payload['msdyn_scheduledstart'] = data['start_date']
        if 'end_date' in data:
            payload['msdyn_scheduledend'] = data['end_date']
        
        result = make_dataverse_request('PATCH', f'msdyn_projecttasks({task_id})', payload)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        return jsonify({'error': str(e)}), 500

@project_bp.route('/api/project/task/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task"""
    try:
        make_dataverse_request('DELETE', f'msdyn_projecttasks({task_id})')
        return jsonify({'success': True}), 200
    except Exception as e:
        logger.error(f"Error deleting task: {e}")
        return jsonify({'error': str(e)}), 500

# Health check endpoint
@project_bp.route('/api/project/health', methods=['GET'])
def health_check():
    """Check if M365 CLI is authenticated and ready"""
    try:
        token = get_m365_token(DATAVERSE_URL)
        return jsonify({
            'status': 'healthy',
            'authenticated': True,
            'dataverse_url': DATAVERSE_URL
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'authenticated': False,
            'error': str(e)
        }), 503

# To register in main.py:
# from project_api import project_bp
# app.register_blueprint(project_bp)
