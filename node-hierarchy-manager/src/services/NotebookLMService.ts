import { supabase } from '../lib/supabase';
import { McpService } from './McpService';

export interface NotebookLMNotebook {
    id: number;
    notebook_id: string;
    notebook_grp: 'Client' | 'Tulkah AI' | 'MDM' | 'Process Mining' | 'Antigravity' | 'AI Developments' | 'Other';
    notebook_nm: string;
    notebook_desc: string | null;
    created_at?: string;
    updated_at?: string;
}

export const NotebookLMService = {
    /**
     * Fetch all notebooks from Supabase cache
     */
    async fetchNotebooks(): Promise<NotebookLMNotebook[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('user_notebooks')
            .select('*')
            .eq('user_id', user.id)
            .order('notebook_grp', { ascending: true })
            .order('notebook_nm', { ascending: true });

        if (error) {
            console.error('Error fetching notebooks from Supabase:', error);
            throw new Error('Failed to fetch notebooks');
        }

        return data as NotebookLMNotebook[];
    },

    /**
     * Refresh notebooks from NotebookLM and store in Supabase
     * This calls the backend MCP service to get live notebooks,
     * then categorizes them and stores in Supabase
     */
    async refreshNotebooks(): Promise<void> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Fetch live notebooks from NotebookLM via MCP
            const liveNotebooks = await McpService.listNotebooks();

            // Categorize notebooks based on title patterns
            const categorizedNotebooks = liveNotebooks.map(nb => ({
                notebook_id: nb.id,
                notebook_grp: this.categorizeNotebook(nb.title),
                notebook_nm: nb.title,
                notebook_desc: `${nb.source_count} sources` // Could be enhanced with more metadata
            }));

            // Call Supabase RPC to refresh the table
            const { error } = await supabase.rpc('sync_user_notebooks', {
                notebooks_data: categorizedNotebooks
            });

            if (error) {
                console.error('Error refreshing notebooks in Supabase:', error);
                throw new Error('Failed to refresh notebooks: ' + error.message);
            }
        } catch (err: unknown) {
            console.error('Error in refreshNotebooks:', err);
            throw new Error('Failed to refresh notebooks: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    },

    /**
     * Categorize a notebook based on its title
     */
    categorizeNotebook(title: string): NotebookLMNotebook['notebook_grp'] {
        const lowerTitle = title.toLowerCase();

        // Check for specific keywords in order of priority
        if (lowerTitle.includes('antigravity') || lowerTitle.includes('anti-gravity')) {
            return 'Antigravity';
        }
        if (lowerTitle.includes('tulkah') || lowerTitle.includes('tulkah ai')) {
            return 'Tulkah AI';
        }
        if (lowerTitle.includes('mdm') || lowerTitle.includes('master data')) {
            return 'MDM';
        }
        if (lowerTitle.includes('process mining') || lowerTitle.includes('celonis')) {
            return 'Process Mining';
        }
        if (lowerTitle.includes('ai development') || lowerTitle.includes('machine learning') || lowerTitle.includes('llm')) {
            return 'AI Developments';
        }
        if (lowerTitle.includes('client') || lowerTitle.includes('customer') || lowerTitle.includes('project')) {
            return 'Client';
        }

        // Default category
        return 'Other';
    },

    /**
     * Update cookies via backend endpoint
     */
    async updateCookies(): Promise<void> {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

        try {
            const response = await fetch(`${API_BASE_URL}/api/mcp/update_cookies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || 'Failed to update cookies');
            }

            const result = await response.json();
            if (result.status !== 'success') {
                throw new Error(result.error || 'Failed to update cookies');
            }
        } catch (err: unknown) {
            console.error('Error updating cookies:', err);
            throw new Error('Failed to update cookies: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    }
};
