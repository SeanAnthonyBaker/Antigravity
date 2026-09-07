import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const res616 = await client.query('SELECT "nodeID", title, text, "parentNodeID", level, "order", url, urltype FROM documents WHERE "nodeID" = 616');
        console.log('--- NODE 616 ---');
        console.log(JSON.stringify(res616.rows[0], null, 2));

        const totalRes = await client.query('SELECT count(*) FROM documents');
        console.log('--- TOTAL COUNT ---', totalRes.rows[0].count);

        const textCountRes = await client.query("SELECT count(*) FROM documents WHERE text IS NOT NULL AND trim(text) != '' AND trim(text) != 'New Node'");
        console.log('--- COUNT WITH MEANINGFUL TEXT ---', textCountRes.rows[0].count);

        const allWithText = await client.query("SELECT count(*) FROM documents WHERE text IS NOT NULL AND trim(text) != ''");
        console.log('--- COUNT WITH ANY NON-EMPTY TEXT ---', allWithText.rows[0].count);

        const levels = await client.query("SELECT level, count(*) FROM documents GROUP BY level ORDER BY level");
        console.table(levels.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
