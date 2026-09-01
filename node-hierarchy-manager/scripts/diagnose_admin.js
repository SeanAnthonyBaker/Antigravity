import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";
const client = new Client({ connectionString });

async function diagnose() {
    try {
        await client.connect();
        console.log("Connected.");

        // Check 1: Does the function exist?
        const funcRes = await client.query(`
            SELECT proname FROM pg_proc WHERE proname = 'get_all_users_with_approval';
        `);
        if (funcRes.rows.length === 0) {
            console.error("❌ Function 'get_all_users_with_approval' NOT FOUND in pg_proc.");
            console.log("   -> The migration '20260119000000_add_user_approval_system.sql' likely hasn't been applied.");
        } else {
            console.log("✅ Function 'get_all_users_with_approval' exists.");
        }

        // Check 2: Check columns in user_roles
        const colRes = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'user_roles';
        `);
        const columns = colRes.rows.map(r => r.column_name);
        console.log("user_roles columns:", columns.join(', '));
        if (!columns.includes('approved')) {
            console.error("❌ Column 'approved' NOT FOUND in 'user_roles'.");
            console.log("   -> The migration '20260119000000_add_user_approval_system.sql' likely hasn't been applied.");
        } else {
            console.log("✅ Column 'approved' exists in 'user_roles'.");
        }

        // Check 3: Check user role and approval status
        const email = 'seanbaker513@gmail.com';
        const userRes = await client.query(`
            SELECT u.id, u.email, ur.role, ur.approved
            FROM auth.users u
            LEFT JOIN public.user_roles ur ON u.id = ur.user_id
            WHERE u.email = $1
        `, [email]);

        if (userRes.rows.length === 0) {
            console.error(`❌ User '${email}' not found in auth.users.`);
        } else {
            const user = userRes.rows[0];
            console.log("User details:", user);
            if (user.role !== 'admin') {
                console.error("❌ User role is NOT 'admin'. It is '" + user.role + "'.");
            } else {
                console.log("✅ User has 'admin' role.");
            }
        }

        // Check 4: Use a specific user from the screenshot to test 'approve_user'
        const targetEmail = 'marco.pinheiro@me.com'; // User from screenshot
        console.log(`\nChecking target user '${targetEmail}'...`);

        const targetRes = await client.query(`
            SELECT u.id, u.email, ur.user_id as role_user_id
            FROM auth.users u
            LEFT JOIN public.user_roles ur ON u.id = ur.user_id
            WHERE u.email = $1
        `, [targetEmail]);

        let targetId = null;

        if (targetRes.rows.length === 0) {
            console.log(`⚠️ User '${targetEmail}' not found in DB. Trying to find ANY unapproved user...`);
            const anyRes = await client.query(`
                SELECT u.id, u.email, ur.user_id as role_user_id
                FROM auth.users u
                LEFT JOIN public.user_roles ur ON u.id = ur.user_id
                WHERE ur.approved IS NOT TRUE OR ur.approved IS NULL
                LIMIT 1
            `);
            if (anyRes.rows.length > 0) {
                console.log(`Found alternative unapproved user: ${anyRes.rows[0].email}`);
                targetId = anyRes.rows[0].id;
                if (!anyRes.rows[0].role_user_id) {
                    console.error("❌ This user has NO ROW in 'user_roles' table! This explains why UPDATE fails.");
                } else {
                    console.log("✅ This user has a row in 'user_roles'.");
                }
            } else {
                console.log("No unapproved users found to test.");
            }
        } else {
            const row = targetRes.rows[0];
            targetId = row.id;
            console.log(`Found target user ID: ${targetId}`);
            if (!row.role_user_id) {
                console.error("❌ This user has NO ROW in 'user_roles' table! This explains why UPDATE fails.");
            } else {
                console.log("✅ This user has a row in 'user_roles'.");
            }
        }

        // Check 5: Simulate RPC call for get_users (already verified, keeping short)
        if (userRes.rows.length > 0 && targetId) {
            const adminId = userRes.rows[0].id;
            console.log(`\nSimulating 'approve_user' RPC call as admin ${adminId}...`);

            try {
                await client.query('BEGIN');
                await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [adminId]);

                // Call approve_user
                await client.query(`SELECT public.approve_user($1)`, [targetId]);

                console.log(`✅ 'approve_user' Call Success!`);
                await client.query('ROLLBACK'); // Always rollback test
            } catch (rpcErr) {
                await client.query('ROLLBACK');
                console.error("❌ 'approve_user' RPC Call Failed:", rpcErr.message);
                if (rpcErr.hint) console.error("Hint:", rpcErr.hint);
                if (rpcErr.detail) console.error("Detail:", rpcErr.detail);
                if (rpcErr.code) console.error("Code:", rpcErr.code);
            }
        }

        // Check 6: Simulate RPC call
        if (userRes.rows.length > 0) {
            const userId = userRes.rows[0].id;
            console.log(`\nSimulating RPC call for user ${userId}...`);

            try {
                await client.query('BEGIN');

                // Simulate auth - we need to set the config that auth.uid() reads
                // In Supabase/PostgREST this is request.jwt.claim.sub
                await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);

                // Also need to be 'authenticated' role ideally, but as postgres superuser we bypass some checks
                // EXCEPT schema usage. But validation inside the function uses auth.uid().
                // The function itself is SECURITY DEFINER, so it runs as owner (postgres), 
                // but it explicitly checks auth.uid().

                const rpcRes = await client.query('SELECT * FROM public.get_all_users_with_approval()');
                console.log(`✅ RPC Call Success! Returned ${rpcRes.rowCount} rows.`);
                console.log("First row example:", rpcRes.rows[0]);

                await client.query('COMMIT');
            } catch (rpcErr) {
                await client.query('ROLLBACK');
                console.error("❌ RPC Call Failed:", rpcErr.message);
                if (rpcErr.hint) console.error("Hint:", rpcErr.hint);
                if (rpcErr.detail) console.error("Detail:", rpcErr.detail);
                if (rpcErr.code) console.error("Code:", rpcErr.code);
            }
        }

    } catch (err) {
        console.error("Diagnosis failed:", err);
    } finally {
        await client.end();
    }
}

diagnose();
