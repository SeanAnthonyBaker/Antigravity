import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const node261 = await client.query('SELECT * FROM documents WHERE "nodeID" = 261');
        console.log('--- NODE 261 (Parent) ---');
        console.log(node261.rows);

        const siblings = await client.query('SELECT "nodeID", title, text, level, "order", url, urltype FROM documents WHERE "parentNodeID" = 261 ORDER BY "order"');
        console.log('--- SIBLINGS OF 616 (Parent 261) ---');
        console.table(siblings.rows);

        const children616 = await client.query('SELECT "nodeID", title, text, level, "order", url, urltype FROM documents WHERE "parentNodeID" = 616 ORDER BY "order"');
        console.log('--- CHILDREN OF 616 ---');
        console.table(children616.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
