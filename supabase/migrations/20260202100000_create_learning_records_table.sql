-- Migration: Create Learning Records Table
-- Tracks knowledge test results, scores, success rates by user and parent topic node.

CREATE TABLE IF NOT EXISTS public.learning_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_node_id BIGINT NOT NULL,
    test_node_id BIGINT,
    subnode_id BIGINT,
    difficulty TEXT NOT NULL,
    success_rate NUMERIC(5, 2) NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast queries by user and parent node
CREATE INDEX IF NOT EXISTS idx_learning_records_user_parent ON public.learning_records(user_id, parent_node_id);

-- Enable RLS
ALTER TABLE public.learning_records ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own learning records
DROP POLICY IF EXISTS "Users can manage own learning records" ON public.learning_records;
CREATE POLICY "Users can manage own learning records"
    ON public.learning_records
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow admins to read all learning records
DROP POLICY IF EXISTS "Admins can read all learning records" ON public.learning_records;
CREATE POLICY "Admins can read all learning records"
    ON public.learning_records
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
