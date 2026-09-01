import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";
const client = new Client({ connectionString });

const fixSQL = `
-- 1. Redefine approve_user to be robust (INSERT ON CONFLICT UPDATE)
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the calling user is an admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only admins can approve users';
    END IF;

    -- Upsert the user role status
    -- This handles cases where the user exists in auth.users but not in user_roles
    INSERT INTO public.user_roles (user_id, role, approved)
    VALUES (target_user_id, 'user', true)
    ON CONFLICT (user_id) 
    DO UPDATE SET approved = true;
    
    -- No need for "IF NOT FOUND" check because insert/update always succeeds unless user_id is invalid foreign key
    -- But since we take UUID, if it doesn't exist in auth.users, foreign key constraint will fail.
END;
$$;

-- 2. Backfill missing user_roles for existing users
INSERT INTO public.user_roles (user_id, role, approved)
SELECT id, 'user', false
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
);
`;

async function fix() {
    try {
        await client.connect();
        console.log("Connected. Applying fix...");
        await client.query(fixSQL);
        console.log("✅ Fix applied: 'approve_user' updated and missing roles backfilled.");
    } catch (err) {
        console.error("❌ Failed to apply fix:", err);
    } finally {
        await client.end();
    }
}

fix();
