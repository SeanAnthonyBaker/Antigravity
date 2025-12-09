# API Key Storage Migration

## Overview
This update moves API key storage from browser localStorage to Supabase database, ensuring:
- **Security**: API keys are stored server-side with encryption
- **User Isolation**: Each user can only access their own API keys
- **Persistence**: Keys persist across devices and browsers

## Database Migration Required

### Step 1: Run the SQL Migration
Execute the SQL file in your Supabase SQL Editor:

```bash
# File: supabase_migration_api_keys.sql
```

This will create:
- `user_api_keys` table with proper schema
- Row Level Security (RLS) policies
- Indexes for performance

### Step 2: Verify Table Creation
In Supabase Dashboard:
1. Go to **Table Editor**
2. Confirm `user_api_keys` table exists
3. Check that RLS is enabled (green shield icon)

### Step 3: Test the Integration
1. Deploy the updated frontend
2. Log in as a user
3. Select an LLM (Gemini, Grok, or DeepSeek)
4. Enter an API key
5. Verify it saves (check Supabase table)
6. Reload the page - key should persist

## Table Schema

```sql
user_api_keys (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    llm_provider TEXT CHECK (llm_provider IN ('gemini', 'grok', 'deepseek')),
    api_key_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(user_id, llm_provider)
)
```

## Security Features

### Row Level Security Policies
- Users can only **read** their own API keys
- Users can only **insert** their own API keys
- Users can only **update** their own API keys
- Users can only **delete** their own API keys

### API Key Encryption
**Note**: The current implementation stores keys as plain text in the `api_key_encrypted` column. For production, you should:

1. Enable Supabase's built-in encryption
2. Or implement application-level encryption before storing

## Migration from localStorage

Existing users with API keys in localStorage will need to re-enter them. The app will:
1. Check Supabase for stored keys
2. Fall back to environment variables if not found
3. Prompt user to enter keys if neither exists

## Files Changed

### New Files
- `src/services/ApiKeyService.ts` - Service for managing API keys
- `supabase_migration_api_keys.sql` - Database migration script
- `API_KEY_MIGRATION_README.md` - This file

### Modified Files
- `src/components/AIQueryRefinementModal.tsx` - Updated to use ApiKeyService instead of localStorage

## Rollback Plan

If you need to rollback:

```sql
-- Drop the table and all policies
DROP TABLE IF EXISTS user_api_keys CASCADE;
```

Then revert the code changes to use localStorage again.
