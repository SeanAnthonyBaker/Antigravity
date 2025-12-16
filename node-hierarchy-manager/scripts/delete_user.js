import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function deleteUser() {
    const email = 'Tulkah@btinternet.com';
    try {
        await client.connect();

        // Check if user exists
        const res = await client.query("SELECT id FROM auth.users WHERE email = $1", [email]);

        if (res.rows.length === 0) {
            console.log(`User ${email} not found.`);
            return;
        }

        const userId = res.rows[0].id;
        console.log(`Found user ${email} with ID: ${userId}`);

        // Delete user
        // Note: verify if cascade delete is set up? Migration said:
        // "References auth.users(id) ON DELETE CASCADE" for documents/permissions/roles
        // So deleting from auth.users should clean up everything.

        await client.query("DELETE FROM auth.users WHERE id = $1", [userId]);
        console.log(`User ${email} deleted successfully.`);

    } catch (err) {
        console.error("Error deleting user:", err);
    } finally {
        await client.end();
    }
}

deleteUser();
