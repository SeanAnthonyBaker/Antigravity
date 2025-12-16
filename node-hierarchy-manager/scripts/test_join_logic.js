
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function run() {
    try {
        await client.connect();

        console.log("Checking join matches with decode logic:");
        const query = `
            SELECT d."nodeID", d.url, ot.file_path 
            FROM documents d 
            JOIN object_tags ot ON 
                replace(substring(d.url from '[^/]+$'), '%20', ' ') = ot.file_path
            LIMIT 5
        `;
        const res = await client.query(query);
        console.table(res.rows);

        console.log(`Matched ${res.rows.length} rows.`);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
