import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function verify() {
    try {
        await client.connect();

        // Check for user_id column (Should be gone)
        const colRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'documents' AND column_name = 'user_id'
        `);

        console.log("Checking 'user_id' column:");
        if (colRes.rows.length === 0) {
            console.log("PASS: 'user_id' column not found in 'documents'.");
        } else {
            console.error("FAIL: 'user_id' column still exists.");
        }

        // Check for trigger
        const trigRes = await client.query(`
            SELECT trigger_name 
            FROM information_schema.triggers 
            WHERE event_object_table = 'users' 
            AND trigger_name = 'on_auth_user_created'
        `);

        console.log("\nChecking 'on_auth_user_created' trigger:");
        if (trigRes.rows.length > 0) {
            console.log("PASS: Trigger 'on_auth_user_created' exists on 'auth.users'.");
        } else {
            // Triggers on auth schema might not show up in standard info schema depending on permissions/view, trying direct pg_trigger query
            const pgTrigRes = await client.query(`
                SELECT tgname
                FROM pg_trigger
                WHERE tgname = 'on_auth_user_created'
             `);
            if (pgTrigRes.rows.length > 0) {
                console.log("PASS: Trigger 'on_auth_user_created' found in pg_trigger.");
            } else {
                console.error("FAIL: Trigger not found.");
            }
        }

    } catch (err) {
        console.error("Verification Error:", err);
    } finally {
        await client.end();
    }
}

verify();
