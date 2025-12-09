-- Create user_api_keys table to store encrypted API keys for each user
CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    llm_provider TEXT NOT NULL CHECK (llm_provider IN ('gemini', 'grok', 'deepseek')),
    api_key_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, llm_provider)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);

-- Enable Row Level Security
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own API keys
CREATE POLICY "Users can read own API keys"
    ON user_api_keys
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own API keys
CREATE POLICY "Users can insert own API keys"
    ON user_api_keys
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own API keys
CREATE POLICY "Users can update own API keys"
    ON user_api_keys
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own API keys
CREATE POLICY "Users can delete own API keys"
    ON user_api_keys
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE user_api_keys IS 'Stores encrypted API keys for different LLM providers per user';
