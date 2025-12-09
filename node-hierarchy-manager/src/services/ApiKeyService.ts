import { supabase } from '../lib/supabase';

export interface UserApiKey {
    id: string;
    user_id: string;
    llm_provider: 'gemini' | 'grok' | 'deepseek';
    api_key_encrypted: string;
    created_at: string;
    updated_at: string;
}

export const ApiKeyService = {
    /**
     * Fetch all API keys for a user
     */
    async fetchApiKeys(userId: string): Promise<Record<string, string>> {
        const { data, error } = await supabase
            .from('user_api_keys')
            .select('llm_provider, api_key_encrypted')
            .eq('user_id', userId);

        if (error) throw error;

        // Convert array to object for easy lookup
        const keys: Record<string, string> = {};
        data?.forEach(item => {
            keys[item.llm_provider] = item.api_key_encrypted;
        });
        return keys;
    },

    /**
     * Save or update an API key for a specific LLM provider
     */
    async saveApiKey(userId: string, provider: 'gemini' | 'grok' | 'deepseek', apiKey: string) {
        // Check if key already exists
        const { data: existing } = await supabase
            .from('user_api_keys')
            .select('id')
            .eq('user_id', userId)
            .eq('llm_provider', provider)
            .single();

        if (existing) {
            // Update existing key
            const { error } = await supabase
                .from('user_api_keys')
                .update({
                    api_key_encrypted: apiKey,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (error) throw error;
        } else {
            // Insert new key
            const { error } = await supabase
                .from('user_api_keys')
                .insert([{
                    user_id: userId,
                    llm_provider: provider,
                    api_key_encrypted: apiKey
                }]);

            if (error) throw error;
        }
    },

    /**
     * Delete an API key for a specific LLM provider
     */
    async deleteApiKey(userId: string, provider: 'gemini' | 'grok' | 'deepseek') {
        const { error } = await supabase
            .from('user_api_keys')
            .delete()
            .eq('user_id', userId)
            .eq('llm_provider', provider);

        if (error) throw error;
    }
};
