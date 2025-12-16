
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function debugSchema() {
    try {
        await client.connect();
        console.log("Connected to database.");

        // Query for constraints on document_permissions
        const res = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.conrelid = 'public.document_permissions'::regclass
    `);

        console.log("Constraints on document_permissions:");
        res.rows.forEach(row => {
            console.log(`- ${row.conname}: ${row.pg_get_constraintdef}`);
        });

        // Also check current data for sean.baker@nttdata.com
        const email = 'sean.baker@nttdata.com';
        const userRes = await client.query("SELECT id FROM auth.users WHERE email = $1", [email]);
        if (userRes.rows.length > 0) {
            console.log(`User ID for ${email}: ${userRes.rows[0].id}`);
        } else {
            console.log(`User ${email} not found.`);
        }

    } catch (err) {
        console.error("Error executing schema debug:", err);
    } finally {
        await client.end();
    }
}

debugSchema();
