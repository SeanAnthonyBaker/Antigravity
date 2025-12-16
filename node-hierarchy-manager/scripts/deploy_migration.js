import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Client } = pg;

// Connection string from your existing config/scripts
const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function runMigration() {
    try {
        console.log("Connecting to database...");
        await client.connect();

        const migrationPath = path.join(process.cwd(), '../supabase/migrations/20251216000000_refactor_object_tags_to_files.sql');
        console.log(`Reading migration file: ${migrationPath}`);

        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found at ${migrationPath}`);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log("Executing migration...");
        // pg driver allows executing multiple statements if passed as a single string
        await client.query(sql);

        console.log("SUCCESS: Migration executed successfully.");
    } catch (err) {
        console.error("ERROR: Failed to execute migration.");
        console.error(err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
