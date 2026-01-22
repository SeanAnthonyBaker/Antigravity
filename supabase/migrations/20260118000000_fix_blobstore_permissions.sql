-- Migration: Fix BlobStore Permissions
-- Ensures BlobStore bucket exists and has correct RLS policies

-- 1. Create BlobStore bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('BlobStore', 'BlobStore', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies for BlobStore if any
DROP POLICY IF EXISTS "Public Select" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;

-- 3. Create permissive policies for BlobStore
-- In a production app, you might want to restrict this more, 
-- but for internalization to work easily, we allow public insert and select for now.

CREATE POLICY "BlobStore Public Select"
ON storage.objects FOR SELECT
USING ( bucket_id = 'BlobStore' );

CREATE POLICY "BlobStore Public Insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'BlobStore' );

CREATE POLICY "BlobStore Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'BlobStore' );

CREATE POLICY "BlobStore Public Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'BlobStore' );
