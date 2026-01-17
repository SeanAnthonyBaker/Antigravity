import os
import threading
import signal
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, send_from_directory
from flask_cors import CORS
from models import db
from user import user_bp
from notebooklm import notebooklm_bp, browser_lock, start_browser_initialization_thread, reset_browser
from grok import grok_bp
from deepseek import deepseek_bp

# Configure logging for the application
# Set up log directory
LOG_DIR = os.environ.get('LOG_DIR', './logs')
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, 'notebooklm.log')

# Create formatter
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Console handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

# File handler with rotation (10MB max size, keep 5 backups)
file_handler = RotatingFileHandler(
    LOG_FILE,
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5,
    encoding='utf-8'
)
file_handler.setFormatter(log_formatter)

# Configure root logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.addHandler(console_handler)
root_logger.addHandler(file_handler)

logging.info(f"Logging initialized. Log file: {LOG_FILE}")

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# Load secret key from environment variable for better security
SECRET_KEY = os.environ.get('FLASK_SECRET_KEY', 'a-default-insecure-secret-key-for-dev')
if SECRET_KEY == 'a-default-insecure-secret-key-for-dev' and os.environ.get('FLASK_ENV') == 'production':
    logging.warning("SECURITY WARNING: Using default insecure secret key in production. Set the FLASK_SECRET_KEY environment variable.")
app.config['SECRET_KEY'] = SECRET_KEY

# Enable CORS for all routes (required for frontend access)
# In production, CORS is handled by the reverse proxy (Caddy) to avoid duplicate headers.
if os.environ.get('FLASK_ENV') != 'production':
    CORS(app)

app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(notebooklm_bp, url_prefix='/api')
app.register_blueprint(grok_bp, url_prefix='/api')
app.register_blueprint(deepseek_bp, url_prefix='/api')

from mcp_bp import mcp_bp
app.register_blueprint(mcp_bp, url_prefix='/api/mcp')

# Ensure the database directory exists
db_path = os.path.join(os.path.dirname(__file__), 'database')
os.makedirs(db_path, exist_ok=True)

app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(db_path, 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
with app.app_context(): # Creates tables if they don't exist
    db.create_all()

# Graceful shutdown handler
def graceful_shutdown(signum, frame):
    """Ensures the browser is closed cleanly on app termination."""
    logging.info("Shutdown signal received. Closing browser instance...")
    with browser_lock:
        reset_browser()
    exit(0)

signal.signal(signal.SIGINT, graceful_shutdown)
signal.signal(signal.SIGTERM, graceful_shutdown)

# Browser is now initialized on-demand during query execution, not on startup
# This ensures VNC shows a clean desktop when no queries are running
# start_browser_initialization_thread()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if path is None:
        return send_from_directory(static_folder_path, 'index.html')
    if isinstance(path, str) and path:
        full_path = os.path.join(static_folder_path, path)
        if os.path.exists(full_path):
            return send_from_directory(static_folder_path, path)
    return send_from_directory(static_folder_path, 'index.html')


if __name__ == '__main__':
    # Use the PORT environment variable if it's set, otherwise default to 5000
    port = int(os.environ.get('PORT', 5000))
    # The debug flag should be False in a production environment
    debug = os.environ.get('FLASK_ENV') != 'production'
    logging.info(f"Starting server on host 0.0.0.0, port {port}, debug={debug}")
    app.run(host='0.0.0.0', port=port, debug=debug)
