
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import fs from 'fs';

const supabaseUrl = 'https://ryeoceystuqrdynbtsvt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZW9jZXlzdHVxcmR5bmJ0c3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzM0NTQsImV4cCI6MjA1MTMwOTQ1NH0.-A7yLW7ca1G3i8XOtNsU4Yy69NIc2f3I__BSSKyrA-U';
const supabase = createClient(supabaseUrl, supabaseKey);

const artifacts = [
    'https://lh3.googleusercontent.com/notebooklm/AG60hOrNUhcr3ogXL6PduNcw8C5H071aYW_I3vhRqGG-UGqnuskAdJ8AE0SKkHa9S0p_VsvbdLrTiZPQtUm8h2QQvEb2aywsUphpBOeWqfzCj1_nbywXVCVm53OFi_PY8q217A0bzucPfHFwrtVUbqtejzNFkr5fWCQ=w2752-d-h1536-mp2'
];

async function test() {
    for (const url of artifacts) {
        console.log(`\nTesting URL: ${url}`);

        try {
            // 1. Fetch through proxy
            console.log('1. Fetching via proxy...');
            const proxyUrl = `http://localhost:5000/api/mcp/proxy_artifact?url=${encodeURIComponent(url)}`;
            const response = await axios.get(proxyUrl, { responseType: 'arraybuffer' });
            console.log('   Success! Content-Type:', response.headers['content-type']);
            console.log('   Size:', response.data.byteLength, 'bytes');

            // 2. Upload to Supabase
            console.log('2. Uploading to Supabase (BlobStore)...');
            const fileName = `debug_test_${Date.now()}.png`;
            const { data, error } = await supabase.storage
                .from('BlobStore')
                .upload(fileName, response.data, {
                    contentType: response.headers['content-type'],
                    upsert: true
                });

            if (error) {
                console.error('   Upload Failed:', error);
            } else {
                console.log('   Upload Success!', data.path);
                const { data: { publicUrl } } = supabase.storage.from('BlobStore').getPublicUrl(data.path);
                console.log('   Public URL:', publicUrl);
            }

        } catch (err) {
            console.error('   Process Failed:', err.message);
            if (err.response) {
                console.error('   Status:', err.response.status);
                console.error('   Data:', err.response.data.toString());
            }
        }
    }
}

test();
