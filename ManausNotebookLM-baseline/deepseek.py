from flask import Blueprint, request, jsonify
import requests
import logging

deepseek_bp = Blueprint('deepseek', __name__)

@deepseek_bp.route('/deepseek', methods=['POST'])
def proxy_deepseek():

    try:
        data = request.json
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({"error": "Missing Authorization header"}), 401

        # DeepSeek API endpoint
        url = 'https://api.deepseek.com/chat/completions'
        
        response = requests.post(
            url,
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
        logging.error(f"DeepSeek proxy error: {e}")
        return jsonify({"error": str(e)}), 500
