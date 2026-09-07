import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import fs from 'fs';

const supabase = createClient('https://ryeoceystuqrdynbtsvt.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZW9jZXlzdHVxcmR5bmJ0c3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzM0NTQsImV4cCI6MjA1MTMwOTQ1NH0.-A7yLW7ca1G3i8XOtNsU4Yy69NIc2f3I__BSSKyrA-U');
const { Client } = pg;
const pgClient = new Client({ connectionString: 'postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres' });

async function processNode(nodeId, localImagePath, storageFileName) {
  const fileBuffer = fs.readFileSync(localImagePath);
  const storagePath = `infographics/${storageFileName}`;
  
  const { data, error } = await supabase.storage.from('BlobStore').upload(storagePath, fileBuffer, {
    contentType: 'image/jpeg',
    upsert: true
  });
  if (error) throw error;
  
  const { data: urlData } = supabase.storage.from('BlobStore').getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;
  
  await pgClient.connect();
  await pgClient.query('UPDATE documents SET url = $1, urltype = $2 WHERE "nodeID" = $3', [publicUrl, 'InfoGraphic', nodeId]);
  await pgClient.end();
  
  console.log(`[SUCCESS] Node ${nodeId} updated with URL: ${publicUrl}`);
}

processNode('616', 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/dark_slope_platform_1788772076430.jpg', 'infographic_616_dark_slope_platform.jpg');
