
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function run() {
    try {
        await client.connect();

        console.log("--- Object Tags Sample ---");
        const otRes = await client.query('SELECT * FROM object_tags LIMIT 5');
        console.table(otRes.rows);

        console.log("\n--- Documents with URLs Sample ---");
        const docRes = await client.query("SELECT \"nodeID\", url FROM documents WHERE url IS NOT NULL AND url != '' LIMIT 5");
        console.table(docRes.rows);

        // Check for intersection
        console.log("\n--- Checking Intersection ---");
        const intersection = await client.query(`
            SELECT d."nodeID", d.url, ot.tag_id 
            FROM documents d 
            JOIN object_tags ot ON d.url = ot.file_path 
            LIMIT 5
        `);
        console.table(intersection.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
