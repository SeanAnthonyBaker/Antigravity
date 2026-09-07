import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_api_keys'");
        console.log('user_api_keys columns:');
        console.table(res.rows);

        const res2 = await client.query("SELECT * FROM user_api_keys");
        console.log('user_api_keys rows:');
        console.log(res2.rows);

        const res3 = await client.query("SELECT * FROM generated_artifacts ORDER BY created_at DESC LIMIT 5");
        console.log('generated_artifacts:');
        console.log(res3.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
