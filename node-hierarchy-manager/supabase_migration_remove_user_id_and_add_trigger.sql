-- Migration: Remove user_id from documents and add New User Trigger
-- 1. Remove user_id from documents table
-- 2. Update RLS policies to rely on document_permissions
-- 3. Create trigger to create "Personal Knowledge Base" for new users
-- 4. Update create_node RPC

-- 1. Remove user_id column (SAFEGUARDED)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'user_id') THEN
        ALTER TABLE public.documents DROP COLUMN user_id;
    END IF;
END $$;

-- 2. Update RLS Policies
-- Drop old policies relying on user_id
DROP POLICY IF EXISTS "Users can read own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can read relevant documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update relevant documents" ON public.documents;


-- Create new RLS policies for documents
-- READ: Admin OR Permission Exists OR Doc is Public (if applicable, but assuming private by default)
CREATE POLICY "Enforce Document Permissions for Select" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.document_permissions
            WHERE node_id = public.documents."nodeID"
            AND user_id = auth.uid()
        )
    );

-- UPDATE: Admin OR Full Access Permission
CREATE POLICY "Enforce Document Permissions for Update" ON public.documents
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.document_permissions
            WHERE node_id = public.documents."nodeID"
            AND user_id = auth.uid()
            AND access_level = 'full_access'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.document_permissions
            WHERE node_id = public.documents."nodeID"
            AND user_id = auth.uid()
            AND access_level = 'full_access'
        )
    );

-- INSERT: Authenticated users can insert.
-- Note: Requires immediate permission grant in same transaction for them to see it.
CREATE POLICY "Authenticated Users Can Insert" ON public.documents
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- DELETE: Admin OR Full Access
CREATE POLICY "Enforce Document Permissions for Delete" ON public.documents
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.document_permissions
            WHERE node_id = public.documents."nodeID"
            AND user_id = auth.uid()
            AND access_level = 'full_access'
        )
    );


-- 3. Create Trigger for New Users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    root_node_id bigint;
    new_kb_node_id bigint;
    kb_order integer;
BEGIN
    -- 1. Find Root Node (User requested ID 101)
    root_node_id := 101;

    -- If no root node found, we might need to create one, but assuming one exists.
    IF root_node_id IS NOT NULL THEN
        -- Grant READ ONLY access to Root Node
        INSERT INTO public.document_permissions (node_id, user_id, access_level, docid)
        SELECT root_node_id, new.id, 'read_only', (SELECT docid FROM public.documents WHERE "nodeID" = root_node_id);
    END IF;

    -- 2. Create "Personal Knowledge Base" Node
    -- Calculate new ID
    SELECT COALESCE(MAX("nodeID"), 0) + 1 INTO new_kb_node_id FROM public.documents;
    
    -- Calculate order (append to end of root's children)
    SELECT COALESCE(COUNT(*), 0) INTO kb_order FROM public.documents WHERE "parentNodeID" = root_node_id;

    INSERT INTO public.documents (
        "nodeID",
        "title",
        "parentNodeID",
        "selected",
        "text",
        "order",
        "level",
        "visible",
        "children"
        -- user_id removed
    ) VALUES (
        new_kb_node_id,
        'Personal Knowledge Base',
        root_node_id,
        false,
        'Your personal workspace',
        kb_order,
        1, -- Level 1 (Child of Root)
        true, -- Visible
        false -- No children initially
    );

    -- 3. Grant FULL ACCESS to the new node
    INSERT INTO public.document_permissions (node_id, user_id, access_level, docid)
    VALUES (
        new_kb_node_id, 
        new.id, 
        'full_access', 
        (SELECT docid FROM public.documents WHERE "nodeID" = new_kb_node_id)
    );

    RETURN new;
END;
$$;

-- Drop existing trigger if exists to avoid duplication
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create Trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 4. Update create_node RPC to handle permissions
CREATE OR REPLACE FUNCTION public.create_node(
    title text,
    parentnodeid bigint DEFAULT NULL,
    text text DEFAULT 'New Node',
    userid uuid DEFAULT auth.uid()
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_node_id bigint;
    new_order integer;
    parent_level integer;
    new_docid bigint;
BEGIN
    -- Ensure user is authenticated
    IF userid IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    -- Calculate the next available NodeID
    SELECT COALESCE(MAX("nodeID"), 0) + 1 INTO new_node_id FROM public.documents;

    -- Calculate the order based on existing children
    SELECT COALESCE(COUNT(*), 0) INTO new_order FROM public.documents WHERE "parentNodeID" = parentnodeid;

    -- Get the level of the parent node (if parent exists)
    IF parentnodeid IS NOT NULL THEN
        SELECT "level" INTO parent_level FROM public.documents WHERE "nodeID" = parentnodeid;
    ELSE
        parent_level := -1; -- Root level nodes will be 0
    END IF;

    -- Insert the new node
    INSERT INTO public.documents (
        "nodeID", 
        "title", 
        "parentNodeID", 
        "selected", 
        "text", 
        "order", 
        "level", 
        "visible",
        "children"
    )
    VALUES (
        new_node_id, 
        title, 
        parentnodeid, 
        false, 
        text, 
        new_order, 
        COALESCE(parent_level, -1) + 1, 
        true,
        false
    ) RETURNING docid INTO new_docid;

    -- Update the parent node's children field to true (if parent exists)
    IF parentnodeid IS NOT NULL THEN
        UPDATE public.documents
        SET "children" = true
        WHERE "nodeID" = parentnodeid;
    END IF;

    -- GRANT FULL ACCESS to the creator
    INSERT INTO public.document_permissions (node_id, user_id, access_level, docid)
    VALUES (new_node_id, userid, 'full_access', new_docid);

    RETURN new_node_id;
END;
$$;
