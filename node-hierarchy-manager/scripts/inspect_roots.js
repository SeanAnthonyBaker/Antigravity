import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const roots = await client.query('SELECT "nodeID", title, level, "order", url, urltype FROM documents WHERE level <= 2 ORDER BY level, "order"');
        console.table(roots.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
