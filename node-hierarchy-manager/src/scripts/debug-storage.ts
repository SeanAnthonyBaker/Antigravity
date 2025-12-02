
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ryeoceystuqrdynbtsvt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZW9jZXlzdHVxcmR5bmJ0c3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzM0NTQsImV4cCI6MjA1MTMwOTQ1NH0.-A7yLW7ca1G3i8XOtNsU4Yy69NIc2f3I__BSSKyrA-U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugStorage() {
    console.log('--- Debugging Supabase Storage ---');

    // 1. List all buckets
    console.log('\n1. Listing Buckets:');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
        console.error('Error listing buckets:', bucketError.message);
    } else {
        if (buckets.length === 0) {
            console.log('No buckets found via listBuckets().');
        } else {
            console.log(`Found ${buckets.length} buckets:`);
            buckets.forEach(b => console.log(` - ${b.name} (public: ${b.public})`));
        }
    }

    // 2. Explicitly try to list files in 'blobstore' (or 'BlobStore')
    const bucketNames = ['blobstore', 'BlobStore', 'images', 'avatars']; // Common names to try

    for (const name of bucketNames) {
        console.log(`\n2. Attempting to list files in '${name}' bucket explicitly:`);
        const { data: files, error: filesError } = await supabase
            .storage
            .from(name)
            .list();

        if (filesError) {
            console.error(`Error listing files in '${name}':`, filesError.message);
        } else {
            console.log(`Found ${files?.length || 0} files in '${name}':`);
            if (files && files.length > 0) {
                files.forEach(f => console.log(` - ${f.name}`));
            } else {
                console.log(" (Bucket exists or is accessible, but empty, or RLS prevents listing)");
            }
        }
    }
}

debugStorage();
