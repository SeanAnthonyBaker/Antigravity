"""
Supabase client for backend database operations.

Uses service role key to bypass Row Level Security (RLS) for server-side operations.
"""

import os
import logging
from supabase import create_client, Client
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-loaded client
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Optional[Client]:
    """Get or create the Supabase client."""
    global _supabase_client
    
    if _supabase_client is not None:
        return _supabase_client
    
    url = os.environ.get('SUPABASE_URL')
    service_key = os.environ.get('SUPABASE_SERVICE_KEY')
    
    if not url or not service_key:
        logger.warning("Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.")
        return None
    
    try:
        _supabase_client = create_client(url, service_key)
        logger.info("Supabase client initialized successfully")
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None


def save_generated_artifact(
    user_id: str,
    notebook_id: str,
    artifact_type: str,
    artifact_name: str,
    nlm_artifact_id: Optional[str] = None,
    artifact_url: Optional[str] = None,
    node_id: Optional[int] = None
) -> Optional[dict]:
    """
    Save a generated artifact record to Supabase.
    
    Args:
        user_id: The user's UUID from Supabase auth
        notebook_id: NotebookLM notebook ID
        artifact_type: Type of artifact (audio, video, infographic, etc.)
        artifact_name: Name/title of the artifact
        nlm_artifact_id: Optional artifact ID from NotebookLM
        artifact_url: Optional URL to the artifact
        node_id: Optional node ID from the documents hierarchy
    
    Returns:
        The inserted record or None if failed
    """
    client = get_supabase_client()
    if not client:
        logger.error("Cannot save artifact: Supabase client not available")
        return None
    
    try:
        record = {
            "user_id": user_id,
            "notebook_id": notebook_id,
            "artifact_type": artifact_type,
            "artifact_name": artifact_name,
            "nlm_artifact_id": nlm_artifact_id,
            "artifact_url": artifact_url,
            "node_id": node_id
        }
        
        # Remove None values to let database defaults apply
        record = {k: v for k, v in record.items() if v is not None}
        
        result = client.table("generated_artifacts").insert(record).execute()
        
        if result.data:
            logger.info(f"Saved artifact to Supabase: {result.data[0].get('id')}")
            return result.data[0]
        else:
            logger.warning("Insert returned no data")
            return None
            
    except Exception as e:
        logger.exception(f"Failed to save artifact to Supabase: {e}")
        return None
