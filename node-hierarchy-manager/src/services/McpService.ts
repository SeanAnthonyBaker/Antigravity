import axios from 'axios';
import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export interface Notebook {
    id: string;
    title: string;
    source_count: number;
    url: string;
    ownership: string;
    is_shared: boolean;
    created_at: number;
    modified_at: number;
}

export interface ArtifactResult {
    id: string;
    url: string;
    status: 'completed' | 'processing' | 'failed' | 'pending';
    title: string;
}

export interface StudioStatusResponse {
    status: string;
    artifacts: any[];
}

export const McpService = {
    async listNotebooks(): Promise<Notebook[]> {
        const response = await axios.get(`${API_BASE_URL}/api/mcp/notebooks`);
        if (response.data.status === 'success') {
            return response.data.notebooks;
        }
        throw new Error(response.data.error || 'Failed to list notebooks');
    },

    /**
     * Creates an artifact and starts a background poller to track its status.
     * When complete, it inserts the record into Supabase.
     */
    async createArtifact(params: {
        notebook_id: string;
        artifact_type: string;
        title: string;
        node_id?: number | null; // Optional node ID from hierarchy
        [key: string]: any; // Allow other params
    }): Promise<any> {
        const response = await axios.post(`${API_BASE_URL}/api/mcp/generate_artifact`, params);

        if (response.data.status === 'success') {
            // Fire and Forget: Start polling in background
            this.startPolling(params.notebook_id, params.artifact_type, params.title, params.node_id);
            return response.data;
        }
        throw new Error(response.data.error || 'Failed to create artifact');
    },

    async getStatus(notebookId: string): Promise<any[]> {
        const response = await axios.get(`${API_BASE_URL}/api/mcp/status/${notebookId}`);
        if (response.data.status === 'success') {
            return response.data.artifacts;
        }
        throw new Error(response.data.error || 'Failed to get status');
    },

    getProxyUrl(url: string): string {
        return `${API_BASE_URL}/api/mcp/proxy_artifact?url=${encodeURIComponent(url)}`;
    },

    async fetchBlob(url: string): Promise<Blob> {
        const proxyUrl = this.getProxyUrl(url);
        const response = await axios.get(proxyUrl, { responseType: 'blob' });
        const blob = response.data;

        // If we got JSON back, it's probably an error message from our proxy
        if (blob.type === 'application/json') {
            const text = await blob.text();
            try {
                const json = JSON.parse(text);
                if (json.status === 'error') {
                    throw new Error(json.error || 'Proxy error');
                }
            } catch (e) {
                // Not valid JSON or parsing failed, just throw a generic error
                throw new Error('Received invalid data (likely HTML login page or JSON error)');
            }
        }

        return blob;
    },

    // --- Background Polling Logic ---

    startPolling(notebookId: string, artifactType: string, title: string, nodeId?: number | null) {
        console.log(`[McpService] Starting background polling for ${artifactType} in ${notebookId}`);

        const POLL_INTERVAL = 10000; // 10 seconds
        const MAX_ATTEMPTS = 60; // 10 minutes total
        let attempts = 0;

        const poll = async () => {
            attempts++;
            try {
                const artifacts = await this.getStatus(notebookId);

                // Find the most recent artifact of this type
                // Logic: Filter by type, sort by creation time (or assume API returns newest first)
                // Note: The API returns artifacts with 'created_at' timestamp

                // Simple heuristic: Look for a completed artifact created in the last few minutes
                // Or just look for the newest one and see if it's completed

                // Map frontend types to backend types if needed, or rely on string match
                // We'll trust the list is sorted by recent
                const match = artifacts.find(a =>
                    (a.type === artifactType || artifactType.includes(a.type)) &&
                    (a.status === 'completed')
                );

                if (match) {
                    console.log(`[McpService] Artifact found and completed:`, match);
                    await this.saveToSupabase(notebookId, match, title, nodeId);
                    return; // Stop polling
                }

                if (attempts >= MAX_ATTEMPTS) {
                    console.log(`[McpService] Polling timed out for ${notebookId}`);
                    return;
                }

                // Continue polling
                setTimeout(poll, POLL_INTERVAL);

            } catch (err) {
                console.error(`[McpService] Polling error:`, err);
                // Retry even on error, unless max attempts reached
                if (attempts < MAX_ATTEMPTS) setTimeout(poll, POLL_INTERVAL);
            }
        };

        // Start the first poll after a delay to allow backend to initialize the task
        setTimeout(poll, POLL_INTERVAL);
    },

    async saveToSupabase(notebookId: string, artifact: any, title: string, nodeId?: number | null) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('[McpService] Cannot save to Supabase: User not logged in');
                return;
            }

            console.log('[McpService] Saving artifact to Supabase...', artifact);

            const artifactId = artifact.id || artifact.artifact_id;
            if (!artifactId) {
                console.error('[McpService] No artifact ID found, cannot save to DB');
                return;
            }

            const { data: existing } = await supabase
                .from('generated_artifacts')
                .select('id')
                .eq('nlm_artifact_id', artifactId)
                .single();

            if (existing) {
                console.log('[McpService] Artifact already exists in DB, skipping insert.');
                return;
            }

            const { error } = await supabase
                .from('generated_artifacts')
                .insert({
                    user_id: user.id,
                    notebook_id: notebookId,
                    nlm_artifact_id: artifact.id || artifact.artifact_id || null,
                    artifact_url: artifact.url || artifact.audio_url || artifact.video_url || artifact.infographic_url || artifact.slide_deck_url || null,
                    artifact_type: artifact.type,
                    artifact_name: title, // Use the provided title/name
                    node_id: nodeId,      // Store hierarchy node ID
                    created_at: new Date().toISOString() // Or artifact.created_at
                });

            if (error) {
                console.error('[McpService] Failed to insert into generated_artifacts:', error);
            } else {
                console.log('[McpService] Artifact saved to Supabase successfully!');
            }

        } catch (err) {
            console.error('[McpService] Error saving to Supabase:', err);
        }
    }
};
