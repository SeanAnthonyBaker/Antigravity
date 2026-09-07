import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const ids = [634, 635, 636, 637, 638, 639];
        for (const id of ids) {
            const res = await client.query('SELECT "nodeID", title, text FROM documents WHERE "nodeID" = $1', [id]);
            console.log(`=== Node ${id}: ${res.rows[0].title} ===`);
            console.log(res.rows[0].text.substring(0, 250) + '...\n');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
