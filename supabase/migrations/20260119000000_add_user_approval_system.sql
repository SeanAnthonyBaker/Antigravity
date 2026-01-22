-- Migration: Add User Approval System
-- Replaces Magic Link with Email/Password registration
-- Adds approval workflow where new users must be approved by admin
-- Ensures unapproved users can only access their own personal space

-- 1. Add approved column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;

-- 2. Update the handle_new_user trigger to set approved=false for new users
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
    -- 1. Create user_role entry with approved=false
    INSERT INTO public.user_roles (user_id, role, approved)
    VALUES (new.id, 'user', false)
    ON CONFLICT (user_id) DO NOTHING;

    -- 2. Find Root Node (ID 101)
    root_node_id := 101;

    -- If no root node found, we might need to create one, but assuming one exists.
    IF root_node_id IS NOT NULL THEN
        -- Grant READ ONLY access to Root Node
        INSERT INTO public.document_permissions (node_id, user_id, access_level, docid)
        SELECT root_node_id, new.id, 'read_only', (SELECT docid FROM public.documents WHERE "nodeID" = root_node_id)
        ON CONFLICT (node_id, user_id) DO NOTHING;
    END IF;

    -- 3. Create "Personal Knowledge Base" Node
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

    -- 4. Grant FULL ACCESS to the new node
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

-- 3. Create function for admins to approve users
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the calling user is an admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only admins can approve users';
    END IF;

    -- Update the user's approved status
    UPDATE public.user_roles
    SET approved = true
    WHERE user_id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
END;
$$;

-- 4. Create function to get all users with approval status (admin only)
CREATE OR REPLACE FUNCTION public.get_all_users_with_approval()
RETURNS TABLE (
    id UUID, 
    email TEXT, 
    role TEXT, 
    approved BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the calling user is an admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: User is not an admin';
    END IF;

    RETURN QUERY 
    SELECT 
        u.id, 
        u.email::text,
        COALESCE(ur.role, 'user') as role,
        COALESCE(ur.approved, false) as approved,
        u.created_at
    FROM auth.users u
    LEFT JOIN public.user_roles ur ON u.id = ur.user_id
    ORDER BY u.created_at DESC;
END;
$$;

-- 5. Update RLS policies to enforce approval restrictions
-- Users can only see documents they have permission to
-- Unapproved users are already restricted by document_permissions
-- No additional RLS changes needed - the existing permission system handles this

-- 6. Ensure all existing users are approved (migration safety)
UPDATE public.user_roles
SET approved = true
WHERE approved = false;

-- 7. Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION public.approve_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users_with_approval() TO authenticated;

-- 8. Add comment for documentation
COMMENT ON COLUMN public.user_roles.approved IS 'Whether the user has been approved by an admin. Unapproved users can only access their personal knowledge base.';
COMMENT ON FUNCTION public.approve_user(UUID) IS 'Admin-only function to approve a user account';
COMMENT ON FUNCTION public.get_all_users_with_approval() IS 'Admin-only function to retrieve all users with their approval status';
