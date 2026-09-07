import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const treeRes = await client.query(`
            WITH RECURSIVE subnodes AS (
                SELECT "nodeID", title, text, "parentNodeID", level, "order", url, urltype
                FROM documents
                WHERE "nodeID" = 616
                UNION ALL
                SELECT d."nodeID", d.title, d.text, d."parentNodeID", d.level, d."order", d.url, d.urltype
                FROM documents d
                JOIN subnodes s ON d."parentNodeID" = s."nodeID"
            )
            SELECT level, count(*) as total,
                   count(CASE WHEN url IS NOT NULL AND url != '' THEN 1 END) as completed,
                   count(CASE WHEN url IS NULL OR url = '' THEN 1 END) as pending
            FROM subnodes
            GROUP BY level
            ORDER BY level;
        `);
        console.table(treeRes.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
