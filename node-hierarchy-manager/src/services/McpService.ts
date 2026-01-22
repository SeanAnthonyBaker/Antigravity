import axios from 'axios';

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

    async createArtifact(params: {
        notebook_id: string;
        artifact_type: 'infographic' | 'video' | 'audio' | 'slides';
        language?: string;
        prompt?: string;
        orientation?: number;
        detail_level?: number;
        format_code?: number;
        style_code?: number;
        length_code?: number;
    }): Promise<any> {
        const response = await axios.post(`${API_BASE_URL}/api/mcp/create`, params);
        if (response.data.status === 'success') {
            return response.data.result;
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
    }
};
