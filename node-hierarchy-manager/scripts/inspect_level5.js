import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT "nodeID", title, text, level, "order"
            FROM documents
            WHERE "nodeID" IN (616, 618, 623, 628, 633, 640, 647, 652, 657)
            ORDER BY level, "order"
        `);
        for (const row of res.rows) {
            console.log(`=== Node ${row.nodeID}: ${row.title} (Level ${row.level}) ===`);
            console.log(row.text.substring(0, 300) + (row.text.length > 300 ? '...' : ''));
            console.log();
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
