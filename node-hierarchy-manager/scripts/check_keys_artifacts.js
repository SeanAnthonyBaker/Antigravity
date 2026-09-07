import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const res = await client.query('SELECT user_id, service_name, created_at FROM user_api_keys');
        console.log('--- USER API KEYS ---');
        console.table(res.rows);

        const artRes = await client.query('SELECT id, artifact_type, title, storage_path, created_at FROM generated_artifacts ORDER BY created_at DESC LIMIT 10');
        console.log('--- GENERATED ARTIFACTS ---');
        console.table(artRes.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
