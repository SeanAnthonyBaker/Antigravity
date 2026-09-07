import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const res = await client.query('SELECT "nodeID", title, text FROM documents WHERE "nodeID" = 617');
        console.log('TITLE:', res.rows[0].title);
        console.log('TEXT:', res.rows[0].text);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
