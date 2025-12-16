import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function deleteUser() {
    const targetUserId = 'a91bb33f-fe30-4558-bb9c-14f7e34eaaa7';
    try {
        await client.connect();

        console.log(`Deleting user with ID: ${targetUserId}`);

        // Delete user
        await client.query("DELETE FROM auth.users WHERE id = $1", [targetUserId]);
        console.log(`User deleted successfully.`);

    } catch (err) {
        console.error("Error deleting user:", err);
    } finally {
        await client.end();
    }
}

deleteUser();
