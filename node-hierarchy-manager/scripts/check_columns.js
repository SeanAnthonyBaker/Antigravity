
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function run() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'documents'
        `);
        console.log("Columns in documents table:", res.rows.map(r => r.column_name));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
