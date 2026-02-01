import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";
const client = new Client({ connectionString });

const fixedFunctionSQL = `
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
    -- Fix: Use alias 'ur' to avoid ambiguity with output parameter 'role'
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
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
`;

async function fix() {
    try {
        await client.connect();
        console.log("Connected. Applying fix...");
        await client.query(fixedFunctionSQL);
        console.log("✅ Function updated successfully.");
    } catch (err) {
        console.error("❌ Failed to update function:", err);
    } finally {
        await client.end();
    }
}

fix();
