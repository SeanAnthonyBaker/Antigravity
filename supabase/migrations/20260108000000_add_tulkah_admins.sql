-- Migration: Add Tulkah.AI Admin Users
-- Assigns admin role to all specified Tulkah.AI team members

DO $$
DECLARE
    admin_emails TEXT[] := ARRAY[
        'pavelkostenko@tulkahaiaglesolutioning.onmicrosoft.com',
        'marcopinheiro@tulkahaiaglesolutioning.onmicrosoft.com',
        'phil@tulkahaiaglesolutioning.onmicrosoft.com',
        'seanbaker@tulkahaiaglesolutioning.onmicrosoft.com',
        'seanbaker513@gmail.com',
        'philsageuk@yahoo.co.uk'
    ];
    email TEXT;
    target_user_id UUID;
BEGIN
    FOREACH email IN ARRAY admin_emails
    LOOP
        -- Find the user ID (case-insensitive match)
        SELECT id INTO target_user_id 
        FROM auth.users 
        WHERE LOWER(auth.users.email) = LOWER(email);

        IF target_user_id IS NULL THEN
            RAISE NOTICE 'User % not found in auth.users. Skipping admin assignment.', email;
        ELSE
            -- Insert or Update user_roles
            INSERT INTO public.user_roles (user_id, role)
            VALUES (target_user_id, 'admin')
            ON CONFLICT (user_id) DO UPDATE
            SET role = 'admin';
            
            RAISE NOTICE 'Admin role assigned to % (ID: %)', email, target_user_id;
        END IF;
    END LOOP;
END $$;
