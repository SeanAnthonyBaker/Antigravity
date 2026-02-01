import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;
const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";
const client = new Client({ connectionString });

async function deploy() {
    try {
        await client.connect();

        const sqlPath = path.join(process.cwd(), '../supabase/migrations/20260201000000_add_delete_user.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Applying migration...");
        await client.query(sql);
        console.log("✅ Migration applied: 'delete_user' RPC function created.");

    } catch (err) {
        console.error("Deploy failed:", err);
    } finally {
        await client.end();
    }
}

deploy();
