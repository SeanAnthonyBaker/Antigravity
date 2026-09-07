import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient('https://ryeoceystuqrdynbtsvt.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZW9jZXlzdHVxcmR5bmJ0c3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzM0NTQsImV4cCI6MjA1MTMwOTQ1NH0.-A7yLW7ca1G3i8XOtNsU4Yy69NIc2f3I__BSSKyrA-U');

async function uploadTest() {
  const filePath = 'C:/Users/seanb/.gemini/antigravity/brain/d7c639a4-2556-4450-bf4b-b97ef5b2e7cd/dark_slope_concept_1788771986111.jpg';
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = 'infographics/infographic_617_dark_slope_concept.jpg';

  console.log('Uploading to BlobStore:', storagePath);
  const { data, error } = await supabase.storage.from('BlobStore').upload(storagePath, fileBuffer, {
    contentType: 'image/jpeg',
    upsert: true
  });

  if (error) {
    console.error('Upload error:', error);
  } else {
    console.log('Upload success:', data);
    const { data: urlData } = supabase.storage.from('BlobStore').getPublicUrl(storagePath);
    console.log('Public URL:', urlData.publicUrl);
  }
}

uploadTest();
