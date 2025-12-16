
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function run() {
    try {
        await client.connect();

        console.log("--- Object Tags Sample ---");
        const otRes = await client.query('SELECT file_path FROM object_tags LIMIT 5');
        console.log(otRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
