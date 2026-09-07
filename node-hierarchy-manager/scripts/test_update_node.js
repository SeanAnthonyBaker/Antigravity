import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const testUrl = 'https://ryeoceystuqrdynbtsvt.supabase.co/storage/v1/object/public/BlobStore/infographics/infographic_617_dark_slope_concept.jpg';
        await client.query('UPDATE documents SET url = $1, urltype = $2, modified_at = NOW() WHERE "nodeID" = 617', [testUrl, 'InfoGraphic']);
        const res = await client.query('SELECT "nodeID", title, url, urltype, modified_at FROM documents WHERE "nodeID" = 617');
        console.log('Updated node 617:');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
