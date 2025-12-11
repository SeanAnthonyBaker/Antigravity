-- Migration: Add user_id to documents table with cascade delete
-- This migration adds user_id column to documents table if it doesn't exist
-- and sets up the foreign key constraint with ON DELETE CASCADE

-- Add user_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.documents 
        ADD COLUMN user_id UUID;
    END IF;
END $$;

-- Add foreign key constraint with CASCADE delete if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_user_id_fkey' 
        AND table_name = 'documents'
    ) THEN
        ALTER TABLE public.documents
        ADD CONSTRAINT documents_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);

-- Update existing rows to set user_id (if you have existing data)
-- This will set all existing documents to the first user in the system
-- You may want to customize this based on your needs
DO $$
DECLARE
    first_user_id UUID;
BEGIN
    -- Only update if there are NULL user_ids
    IF EXISTS (SELECT 1 FROM public.documents WHERE user_id IS NULL) THEN
        -- Get the first user (you may want to change this logic)
        SELECT id INTO first_user_id FROM auth.users LIMIT 1;
        
        IF first_user_id IS NOT NULL THEN
            UPDATE public.documents 
            SET user_id = first_user_id 
            WHERE user_id IS NULL;
        END IF;
    END IF;
END $$;

-- Make user_id NOT NULL after setting values
ALTER TABLE public.documents 
ALTER COLUMN user_id SET NOT NULL;

-- Add RLS policies for documents table
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own documents
DROP POLICY IF EXISTS "Users can read own documents" ON public.documents;
CREATE POLICY "Users can read own documents"
    ON public.documents
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own documents
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
CREATE POLICY "Users can insert own documents"
    ON public.documents
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own documents
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
CREATE POLICY "Users can update own documents"
    ON public.documents
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own documents
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can delete own documents"
    ON public.documents
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment
COMMENT ON COLUMN public.documents.user_id IS 'References the user who owns this document. Cascade deletes when user is deleted.';
