import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking object_tags table...');

    // Try to select file_path column
    const { data, error } = await supabase
        .from('object_tags')
        .select('file_path, tag_id')
        .limit(1);

    if (error) {
        console.error('Error querying object_tags:', error);
        console.error('Details:', error.message, error.details, error.hint);
    } else {
        console.log('Success! Table schema seems correct.');
        console.log('Data sample:', data);
    }
}

checkSchema();
