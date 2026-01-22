
import pg from 'pg';
const { Client } = pg;
import fs from 'fs';

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

async function applyFix() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const sql = fs.readFileSync('../supabase/migrations/20260118000000_fix_blobstore_permissions.sql', 'utf8');
        console.log('Applying migration...');
        await client.query(sql);
        console.log('Success! BlobStore permissions updated.');
    } catch (err) {
        console.error('Failed to apply migration:', err);
    } finally {
        await client.end();
    }
}

applyFix();
