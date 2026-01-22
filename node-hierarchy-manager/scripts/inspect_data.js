
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function run() {
    try {
        await client.connect();

        console.log("--- Most Recent Documents with URLs ---");
        const docRes = await client.query("SELECT \"nodeID\", title, url, created_at FROM documents WHERE url IS NOT NULL AND url != '' ORDER BY \"nodeID\" DESC LIMIT 20");
        console.table(docRes.rows);

        console.log("\n--- Most Recent Object Tags ---");
        const otRes = await client.query('SELECT * FROM object_tags ORDER BY created_at DESC LIMIT 10');
        console.table(otRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
