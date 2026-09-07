import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://ryeoceystuqrdynbtsvt.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZW9jZXlzdHVxcmR5bmJ0c3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzM0NTQsImV4cCI6MjA1MTMwOTQ1NH0.-A7yLW7ca1G3i8XOtNsU4Yy69NIc2f3I__BSSKyrA-U');

async function list() {
  const { data, error } = await supabase.storage.from('BlobStore').list('', { limit: 50 });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('BlobStore files:');
    console.table(data);
  }
}
list();
