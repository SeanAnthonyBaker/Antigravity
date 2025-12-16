import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Client } = pg;

// Connection string for Setup (Remote Supabase DB)
const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function runMigration() {
    try {
        console.log("Connecting to database...");
        await client.connect();

        // Path to the permission fix migration
        const migrationPath = path.join(process.cwd(), '../supabase/migrations/20240201000001_ensure_admin_role.sql');
        console.log(`Reading migration file: ${migrationPath}`);

        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found at ${migrationPath}`);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log("Executing migration...");
        await client.query(sql);

        console.log("SUCCESS: Migration executed successfully. Admin role granted.");
    } catch (err) {
        console.error("ERROR: Failed to execute migration.");
        console.error(err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
