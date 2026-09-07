import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const nodes = [618, 623, 628, 633, 640, 647, 652, 657];
        for (const id of nodes) {
            const res = await client.query('SELECT "nodeID", title, text FROM documents WHERE "nodeID" = $1', [id]);
            console.log(`\n==================== [NODE ${id}: ${res.rows[0].title}] ====================`);
            console.log(res.rows[0].text);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
