
import pg from 'pg';
const { Client } = pg;

// Database connection string from user + .env logic
// User provided password: AlbieHerbie1!
// Env provided host: db.ryeoceystuqrdynbtsvt.supabase.co
const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function fixAdmin() {
    try {
        await client.connect();
        console.log("Connected to database.");

        const email = 'seanbaker513@gmail.com';

        // 1. Get User ID
        const res = await client.query("SELECT id FROM auth.users WHERE email = $1", [email]);
        if (res.rows.length === 0) {
            console.error(`User with email ${email} not found.`);
            process.exit(1);
        }
        const userId = res.rows[0].id;
        console.log(`Found user ID: ${userId}`);

        // 2. Insert into user_roles (Admin)
        const insertRes = await client.query(`
      INSERT INTO public.user_roles (user_id, role)
      VALUES ($1, 'admin')
      ON CONFLICT (user_id) DO UPDATE SET role = 'admin'
    `, [userId]);
        console.log("Ensured admin role in user_roles.");

        // 3. Remove from document_permissions (Clean slate)
        const deleteRes = await client.query(`
      DELETE FROM public.document_permissions
      WHERE user_id = $1
    `, [userId]);
        console.log(`Deleted ${deleteRes.rowCount} permission records for this user.`);

        console.log("Admin access fix completed successfully.");
    } catch (err) {
        console.error("Error executing fix script:", err);
    } finally {
        await client.end();
    }
}

fixAdmin();
