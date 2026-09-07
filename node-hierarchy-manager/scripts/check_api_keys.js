import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const res = await client.query('SELECT * FROM api_keys');
        console.log('--- API KEYS IN DB ---');
        console.table(res.rows.map(r => ({ ...r, key_value: r.key_value ? r.key_value.substring(0, 8) + '...' : null })));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
