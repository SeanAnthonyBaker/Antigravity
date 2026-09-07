import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import fs from 'fs';

const supabase = createClient('https://ryeoceystuqrdynbtsvt.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZW9jZXlzdHVxcmR5bmJ0c3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzM0NTQsImV4cCI6MjA1MTMwOTQ1NH0.-A7yLW7ca1G3i8XOtNsU4Yy69NIc2f3I__BSSKyrA-U');
const { Client } = pg;
const pgClient = new Client({ connectionString: 'postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres' });

const items = [
  {
    nodeId: '634',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/secondhand_clothing_infographic_1788772568994.jpg',
    storageName: 'infographic_634_secondhand_clothing.jpg'
  },
  {
    nodeId: '635',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/fine_porcelain_infographic_1788772588525.jpg',
    storageName: 'infographic_635_fine_porcelain.jpg'
  },
  {
    nodeId: '636',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/premium_wines_infographic_1788772607500.jpg',
    storageName: 'infographic_636_premium_wines.jpg'
  },
  {
    nodeId: '637',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/school_uniforms_infographic_1788772629386.jpg',
    storageName: 'infographic_637_school_uniforms.jpg'
  },
  {
    nodeId: '638',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/commercial_equipment_infographic_1788772647853.jpg',
    storageName: 'infographic_638_commercial_equipment.jpg'
  },
  {
    nodeId: '639',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/estate_liquidation_infographic_1788772675309.jpg',
    storageName: 'infographic_639_estate_liquidation.jpg'
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
