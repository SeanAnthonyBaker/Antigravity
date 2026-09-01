import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";
const client = new Client({ connectionString });

async function verifyDelete() {
    try {
        await client.connect();

        // 1. Create a dummy entry in public.user_roles to test deletion from PUBLIC table
        // We cannot create in auth.users easily from here, but we can assume deletion from auth.users works
        // if the RPC executes without error. To properly test auth.users deletion, we'd need a real user.
        // Let's create a "fake" user record in user_roles just to test permission.

        const fakeUserId = '11111111-1111-1111-1111-111111111111';

        console.log("Inserting fake user into user_roles...");
        await client.query(`
            INSERT INTO public.user_roles (user_id, role, approved) 
            VALUES ($1, 'user', false) 
            ON CONFLICT (user_id) DO NOTHING
        `, [fakeUserId]);

        // 2. Identify Admin User
        const adminEmail = 'seanbaker513@gmail.com';
        const adminRes = await client.query('SELECT id FROM auth.users WHERE email = $1', [adminEmail]);
        if (adminRes.rows.length === 0) {
            console.error("Admin user not found for simulation.");
            return;
        }
        const adminId = adminRes.rows[0].id;

        // 3. Simulate delete_user RPC call
        console.log(`Simulating 'delete_user' RPC as admin ${adminId}...`);

        try {
            await client.query('BEGIN');
            await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [adminId]);

            // Check if row exists before
            const before = await client.query('SELECT * FROM public.user_roles WHERE user_id = $1', [fakeUserId]);
            console.log("Before delete, fake user role exists:", before.rowCount > 0);

            // Call delete_user
            await client.query('SELECT public.delete_user($1)', [fakeUserId]);

            // Check if row exists after
            const after = await client.query('SELECT * FROM public.user_roles WHERE user_id = $1', [fakeUserId]);
            console.log("After delete, fake user role exists:", after.rowCount > 0);

            if (after.rowCount === 0) {
                console.log("✅ 'delete_user' deleted the public.user_roles record.");
            } else {
                console.error("❌ 'delete_user' FAILED to delete user_roles record.");
            }

            // The auth.users deletion part might show 'NOTICE' but won't throw error if user doesn't exist
            // since we only inserted into public.user_roles.

            await client.query('ROLLBACK'); // Rollback to not leave mess or delete real things if ID wrong
            console.log("Rollback complete.");

        } catch (e) {
            await client.query('ROLLBACK');
            console.error("❌ RPC Execution Failed:", e.message);
        }

    } catch (err) {
        console.error("Script failed:", err);
    } finally {
        await client.end();
    }
}

verifyDelete();
