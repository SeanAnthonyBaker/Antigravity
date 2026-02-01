-- Migration: Add Delete User Function
-- Allows admins to completely remove a user from the system (auth.users and related data)

CREATE OR REPLACE FUNCTION public.delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Check if the calling user is an admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only admins can delete users';
    END IF;

    -- 2. Prevent deleting yourself
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Action Denied: You cannot delete your own account';
    END IF;

    -- 3. Delete from public.document_permissions (Cascades usually, but being explicit is safe)
    DELETE FROM public.document_permissions WHERE user_id = target_user_id;

    -- 4. Delete from public.user_roles
    DELETE FROM public.user_roles WHERE user_id = target_user_id;

    -- 5. Delete from auth.users
    -- This requires the function to be SECURITY DEFINER and owned by a user with permissions on auth schema (usually postgres/supabase_admin)
    DELETE FROM auth.users WHERE id = target_user_id;
    
    IF NOT FOUND THEN
         RAISE NOTICE 'User % not found in auth.users (might have been already deleted)', target_user_id;
    END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_user(UUID) TO authenticated;
