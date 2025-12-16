
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function run() {
    try {
        await client.connect();

        // 1. Get first tag that is used
        const tagRes = await client.query('SELECT t.* FROM tags t JOIN object_tags ot ON t.id = ot.tag_id LIMIT 1');
        if (tagRes.rows.length === 0) {
            console.log('No assigned tags found in object_tags.');
            return;
        }
        const tagId = tagRes.rows[0].id;
        console.log(`Using Tag ID: ${tagId} (${tagRes.rows[0].name})`);

        // 2. Call RPC
        const rpcRes = await client.query('SELECT * FROM get_nodes_by_tags($1)', [[tagId]]);
        console.log(`Found ${rpcRes.rows.length} nodes in hierarchy.`);
        rpcRes.rows.forEach(row => {
            console.log(`- [${row.nodeID}] ${row.title} (Parent: ${row.parentNodeID})`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
