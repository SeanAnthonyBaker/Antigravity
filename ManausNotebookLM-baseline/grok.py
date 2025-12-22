from flask import Blueprint, request, jsonify
import requests
import logging

grok_bp = Blueprint('grok', __name__)

@grok_bp.route('/grok', methods=['POST'])
def proxy_grok():

    try:
        data = request.json
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({"error": "Missing Authorization header"}), 401

        response = requests.post(
            'https://api.x.ai/v1/chat/completions',
            json=data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': auth_header
            }
        )
        
        # Create Flask response from upstream content and status
        from flask import make_response
        flask_response = make_response(response.content, response.status_code)
        
        # Forward safe headers
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers']
        for k, v in response.headers.items():
            if k.lower() not in excluded_headers:
                flask_response.headers[k] = v
                
        return flask_response
    except Exception as e:
        logging.error(f"Grok proxy error: {e}")
        return jsonify({"error": str(e)}), 500
