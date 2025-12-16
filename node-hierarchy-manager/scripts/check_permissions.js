
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function checkPermissions() {
    try {
        await client.connect();
        console.log("Connected to database.");

        const email = 'sean.baker@nttdata.com';

        // 1. Get User ID
        const res = await client.query("SELECT id FROM auth.users WHERE email = $1", [email]);
        if (res.rows.length === 0) {
            console.error(`User with email ${email} not found.`);
            process.exit(1);
        }
        const userId = res.rows[0].id;
        console.log(`Found user ID: ${userId} for ${email}`);

        // 2. Check Permissions
        const permRes = await client.query(`
        SELECT dp.node_id, dp.access_level, d.title
        FROM public.document_permissions dp
        JOIN public.documents d ON dp.node_id = d."nodeID"
        WHERE dp.user_id = $1
    `, [userId]);

        console.log("\nCurrent Permissions:");
        if (permRes.rows.length === 0) {
            console.log("No permissions found for this user.");
        } else {
            permRes.rows.forEach(row => {
                console.log(`- Node: ${row.title} (ID: ${row.node_id}) -> ${row.access_level}`);
            });
        }

        // 3. List 'Client' nodes just to verify what they are trying to assign
        const nodesRes = await client.query(`
        SELECT "nodeID", "title", "user_id" FROM public.documents WHERE title ILIKE '%Client%'
    `);
        console.log("\nNodes matching 'Client':");
        nodesRes.rows.forEach(row => {
            console.log(`- ${row.title} (ID: ${row.nodeID}) - Owner: ${row.user_id}`);
        });


    } catch (err) {
        console.error("Error executing check checkPermissions:", err);
    } finally {
        await client.end();
    }
}

checkPermissions();
