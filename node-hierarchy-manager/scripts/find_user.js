import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function findUser() {
    const emailPattern = '%tulkah%';
    try {
        await client.connect();

        console.log(`Searching for users matching pattern: ${emailPattern}`);
        const res = await client.query("SELECT id, email, created_at FROM auth.users WHERE email ILIKE $1", [emailPattern]);

        if (res.rows.length === 0) {
            console.log("No users found matching that pattern.");
        } else {
            console.log("Found users:");
            res.rows.forEach(user => {
                console.log(`- Email: ${user.email} (ID: ${user.id})`);
            });
        }

    } catch (err) {
        console.error("Error finding user:", err);
    } finally {
        await client.end();
    }
}

findUser();
