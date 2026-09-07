import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const res = await client.query("SELECT \"nodeID\", title, url, urltype FROM documents WHERE urltype = 'InfoGraphic' OR url ILIKE '%infographic%' OR url ILIKE '%info%20graphic%'");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
