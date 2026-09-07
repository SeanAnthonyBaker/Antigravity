import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const res616 = await client.query('SELECT "nodeID", title, text, "parentNodeID", level, "order", url, urltype FROM documents WHERE "nodeID" = 616');
        console.log('Node 616:', JSON.stringify(res616.rows, null, 2));

        const totalRes = await client.query('SELECT count(*) FROM documents');
        console.log('Total documents count:', totalRes.rows[0].count);

        const levelsRes = await client.query('SELECT level, count(*) FROM documents GROUP BY level ORDER BY level');
        console.log('Documents by level:', JSON.stringify(levelsRes.rows, null, 2));

        const sample = await client.query('SELECT "nodeID", title, text, "parentNodeID", level, "order", url, urltype FROM documents ORDER BY "nodeID" ASC LIMIT 5');
        console.log('Sample documents:', JSON.stringify(sample.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
