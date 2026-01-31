-- FIX ADMIN ACCESS SCRIPT
-- Run this in the Supabase Dashboard SQL Editor

-- 1. Ensure approved column exists
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;

-- 2. Create the missing function 'get_all_users_with_approval'
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

-- 3. Create the missing function 'approve_user'
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

    UPDATE public.user_roles
    SET approved = true
    WHERE user_id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
END;
$$;

-- 4. Grant permissions to components
GRANT EXECUTE ON FUNCTION public.get_all_users_with_approval() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_user(UUID) TO authenticated;

-- 5. Explicitly Grant Admin Access to 'seanbaker513@gmail.com'
DO $$
DECLARE
    target_uid UUID;
BEGIN
    SELECT id INTO target_uid FROM auth.users WHERE email = 'seanbaker513@gmail.com';
    
    IF target_uid IS NOT NULL THEN
        -- Insert or Update role to admin and approved=true
        INSERT INTO public.user_roles (user_id, role, approved)
        VALUES (target_uid, 'admin', true)
        ON CONFLICT (user_id) 
        DO UPDATE SET role = 'admin', approved = true;
    END IF;
END $$;
