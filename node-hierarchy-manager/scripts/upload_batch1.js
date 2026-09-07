import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import fs from 'fs';

const supabase = createClient('https://ryeoceystuqrdynbtsvt.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZW9jZXlzdHVxcmR5bmJ0c3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzM0NTQsImV4cCI6MjA1MTMwOTQ1NH0.-A7yLW7ca1G3i8XOtNsU4Yy69NIc2f3I__BSSKyrA-U');
const { Client } = pg;
const pgClient = new Client({ connectionString: 'postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres' });

const items = [
  {
    nodeId: '618',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/core_objective_infographic_1788772110204.jpg',
    storageName: 'infographic_618_core_objective.jpg'
  },
  {
    nodeId: '623',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/dark_inventory_definition_1788772124462.jpg',
    storageName: 'infographic_623_definition_dark_inventory.jpg'
  },
  {
    nodeId: '628',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/system_workflow_infographic_1788772137672.jpg',
    storageName: 'infographic_628_system_workflow.jpg'
  },
  {
    nodeId: '633',
    localPath: 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/target_market_segments_1788772153058.jpg',
    storageName: 'infographic_633_target_market_segments.jpg'
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
