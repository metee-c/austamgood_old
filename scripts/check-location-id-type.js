const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLocationIdType() {
  console.log('🔍 Checking master_location.location_id data type...\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'master_location' 
      AND column_name = 'location_id';
    `
  });

  if (error) {
    // Try direct query
    const { data: result, error: err2 } = await supabase
      .from('master_location')
      .select('location_id')
      .limit(1);
    
    if (result && result.length > 0) {
      console.log('Sample location_id:', result[0].location_id);
      console.log('Type:', typeof result[0].location_id);
    }
  } else {
    console.log('Column info:', data);
  }
}

checkLocationIdType().catch(console.error);
