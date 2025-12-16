-- Migration: Ensure Admin Role for seanbaker513@gmail.com
-- This script safely inserts the admin role if it doesn't exist.

DO $$
DECLARE
    target_email TEXT := 'seanbaker513@gmail.com';
    target_user_id UUID;
BEGIN
    -- 1. Find the user ID
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User % not found in auth.users. skipping admin assignment.', target_email;
    ELSE
        -- 2. Insert or Update user_roles
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin')
        ON CONFLICT (user_id) DO UPDATE
        SET role = 'admin';
        
        RAISE NOTICE 'Admin role assigned to % (ID: %)', target_email, target_user_id;
    END IF;
END $$;
