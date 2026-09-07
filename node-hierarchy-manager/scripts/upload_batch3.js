import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import fs from 'fs';

const supabase = createClient('https://ryeoceystuqrdynbtsvt.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZW9jZXlzdHVxcmR5bmJ0c3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzM0NTQsImV4cCI6MjA1MTMwOTQ1NH0.-A7yLW7ca1G3i8XOtNsU4Yy69NIc2f3I__BSSKyrA-U');
const { Client } = pg;
const pgClient = new Client({ connectionString: 'postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres' });

const items = [
  {
    nodeId: '619',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/digitalize_dark_inventory_1788772271217.jpg',
    storageName: 'infographic_619_digitalize_dark_inventory.jpg'
  },
  {
    nodeId: '620',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/monetize_offline_assets_1788772289530.jpg',
    storageName: 'infographic_620_monetize_offline_assets.jpg'
  },
  {
    nodeId: '621',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/circular_economy_infographic_1788772305823.jpg',
    storageName: 'infographic_621_circular_economy.jpg'
  },
  {
    nodeId: '622',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/service_provider_model_1788772321629.jpg',
    storageName: 'infographic_622_service_provider_model.jpg'
  }
];

async function run() {
  await pgClient.connect();
  for (const item of items) {
    const fileBuffer = fs.readFileSync(item.localPath);
    const storagePath = `infographics/${item.storageName}`;
    
    const { error } = await supabase.storage.from('BlobStore').upload(storagePath, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    });
    if (error) throw error;
    
    const { data: urlData } = supabase.storage.from('BlobStore').getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;
    
    await pgClient.query('UPDATE documents SET url = $1, urltype = $2 WHERE "nodeID" = $3', [publicUrl, 'InfoGraphic', item.nodeId]);
    console.log(`[SUCCESS] Node ${item.nodeId} updated with ${publicUrl}`);
  }
  await pgClient.end();
}

run().catch(console.error);
