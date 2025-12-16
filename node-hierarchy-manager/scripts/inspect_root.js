
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function inspectRoot() {
    try {
        await client.connect();
        console.log("Connected to database.");

        // Find top level nodes
        const res = await client.query(`
            SELECT "nodeID", title, "parentNodeID", level 
            FROM public.documents 
            WHERE "parentNodeID" IS NULL
            ORDER BY "nodeID"
        `);

        console.log("Top Level Nodes (parentNodeID is NULL):");
        res.rows.forEach(row => {
            console.log(`- [${row.nodeID}] ${row.title} (Level: ${row.level})`);
        });

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

inspectRoot();
