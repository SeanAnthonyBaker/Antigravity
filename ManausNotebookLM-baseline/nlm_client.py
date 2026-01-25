"""
NLM CLI Client Wrapper

Provides a Python interface to the nlm (notebooklm-cli) command-line tool.
This replaces direct imports of the notebooklm_mcp library.
"""

import subprocess
import json
import logging
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)

class NLMClientError(Exception):
    """Raised when nlm CLI commands fail"""
    pass

def run_nlm_command(args: List[str], profile: str = "default") -> Dict[str, Any]:
    """
    Execute an nlm command and return the result.
    
    Args:
        args: Command arguments (e.g., ['notebook', 'list', '--json'])
        profile: Profile name to use for authentication
        
    Returns:
        Parsed JSON response if --json flag present, otherwise dict with stdout/stderr
        
    Raises:
        NLMClientError: If command fails
    """
    # Use full path to nlm executable
    nlm_path = '/home/appuser/.local/bin/nlm'
    cmd = [nlm_path] + args + ['--profile', profile]
    
    try:
        logger.debug(f"Running: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            env={'PYTHONIOENCODING': 'utf-8'}  # Handle Unicode in output
        )
        
        # If JSON output requested, parse it
        if '--json' in args or '-j' in args:
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON: {result.stdout}")
                raise NLMClientError(f"Invalid JSON response: {e}")
        
        return {
            "status": "success",
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip()
        }
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {' '.join(cmd)}")
        logger.error(f"Exit code: {e.returncode}, stderr: {e.stderr}")
        raise NLMClientError(f"Command failed: {e.stderr or e.stdout}")

class NLMClient:
    """Wrapper around nlm CLI that mimics the original NotebookLMClient interface"""
    
    def __init__(self, profile: str = "default"):
        """
        Initialize the NLM client.
        
        Args:
            profile: Profile name to use (default: "default")
        """
        self.profile = profile
    
    def list_notebooks(self) -> List[Dict[str, Any]]:
        """
        List all notebooks.
        
        Returns:
            List of notebook dicts with id, title, etc.
        """
        result = run_nlm_command(['notebook', 'list', '--json'], self.profile)
        
        # nlm returns a list of notebooks directly
        if isinstance(result, list):
            return result
        
        # Or it might be wrapped in a dict
        return result.get('notebooks', [])
    
    def create_audio_overview(
        self, 
        notebook_id: str,
        source_ids: Optional[List[str]] = None,
        focus_prompt: Optional[str] = None,
        format: str = "deep_dive",
        length: str = "default",
        language: str = "en"
    ) -> Dict[str, Any]:
        """Create an audio overview (podcast)"""
        args = ['audio', 'create', notebook_id]
        
        if source_ids:
            args.extend(['--source-ids', ','.join(source_ids)])
        if focus_prompt:
            args.extend(['--focus', focus_prompt])
        args.extend(['--format', format])
        args.extend(['--length', length])
        args.extend(['--language', language])
        args.append('--confirm')  # Skip confirmation
        
        return run_nlm_command(args, self.profile)
    
    def create_video_overview(
        self,
        notebook_id: str,
        source_ids: Optional[List[str]] = None,
        focus_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a video overview"""
        args = ['video', 'create', notebook_id]
        
        if source_ids:
            args.extend(['--source-ids', ','.join(source_ids)])
        if focus_prompt:
            args.extend(['--focus', focus_prompt])
        args.append('--confirm')
        
        return run_nlm_command(args, self.profile)
    
    def create_infographic(
        self,
        notebook_id: str,
        source_ids: Optional[List[str]] = None,
        focus_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create an infographic"""
        args = ['infographic', 'create', notebook_id]
        
        if source_ids:
            args.extend(['--source-ids', ','.join(source_ids)])
        if focus_prompt:
            args.extend(['--focus', focus_prompt])
        args.append('--confirm')
        
        return run_nlm_command(args, self.profile)
    
    def create_slide_deck(
        self,
        notebook_id: str,
        source_ids: Optional[List[str]] = None,
        focus_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a slide deck"""
        args = ['slides', 'create', notebook_id]
        
        if source_ids:
            args.extend(['--source-ids', ','.join(source_ids)])
        if focus_prompt:
            args.extend(['--focus', focus_prompt])
        args.append('--confirm')
        
        return run_nlm_command(args, self.profile)
    
    def generate_mind_map(self, source_ids: List[str]) -> Dict[str, Any]:
        """Generate mind map structure (not saved yet)"""
        # Mind maps in nlm don't have a separate generate step
        # We'll just return a placeholder for compatibility
        return {"mind_map_json": {}, "source_ids": source_ids}
    
    def save_mind_map(
        self,
        notebook_id: str,
        mind_map_json: Dict[str, Any],
        source_ids: List[str],
        title: str = "Mind Map"
    ) -> Dict[str, Any]:
        """Save a mind map (create it)"""
        args = ['mindmap', 'create', notebook_id]
        
        if source_ids:
            args.extend(['--source-ids', ','.join(source_ids)])
        args.append('--confirm')
        
        return run_nlm_command(args, self.profile)
    
    def create_report(
        self,
        notebook_id: str,
        source_ids: Optional[List[str]] = None,
        custom_prompt: Optional[str] = None,
        report_format: str = "Briefing Doc"
    ) -> Dict[str, Any]:
        """Create a report"""
        args = ['report', 'create', notebook_id]
        
        if source_ids:
            args.extend(['--source-ids', ','.join(source_ids)])
        if custom_prompt:
            args.extend(['--focus', custom_prompt])
        args.extend(['--format', report_format])
        args.append('--confirm')
        
        return run_nlm_command(args, self.profile)
    
    def create_quiz(self, notebook_id: str, source_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """Create a quiz"""
        args = ['quiz', 'create', notebook_id]
        
        if source_ids:
            args.extend(['--source-ids', ','.join(source_ids)])
        args.append('--confirm')
        
        return run_nlm_command(args, self.profile)
    
    def create_flashcards(self, notebook_id: str, source_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """Create flashcards"""
        args = ['flashcards', 'create', notebook_id]
        
        if source_ids:
            args.extend(['--source-ids', ','.join(source_ids)])
        args.append('--confirm')
        
        return run_nlm_command(args, self.profile)
    
    def create_data_table(
        self,
        notebook_id: str,
        source_ids: Optional[List[str]] = None,
        description: str = "Data Table"
    ) -> Dict[str, Any]:
        """Create a data table"""
        args = ['data-table', 'create', notebook_id]
        
        if source_ids:
            args.extend(['--source-ids', ','.join(source_ids)])
        args.extend(['--description', description])
        args.append('--confirm')
        
        return run_nlm_command(args, self.profile)
    
    def get_notebook_sources_with_types(self, notebook_id: str) -> List[Dict[str, Any]]:
        """Get sources for a notebook"""
        args = ['source', 'list', notebook_id, '--json']
        result = run_nlm_command(args, self.profile)
        
        if isinstance(result, list):
            return result
        return result.get('sources', [])
    
    def poll_studio_status(self, notebook_id: str) -> List[Dict[str, Any]]:
        """
        Poll for artifacts in a notebook.
        Uses 'notebook get' to retrieve artifact status.
        """
        args = ['notebook', 'get', notebook_id, '--json']
        result = run_nlm_command(args, self.profile)
        
        # Extract artifacts from notebook details
        # The structure may vary, adjust as needed based on actual output
        return result.get('artifacts', [])
