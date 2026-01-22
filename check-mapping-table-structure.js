require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMappingTable() {
  console.log('🔍 ตรวจสอบโครงสร้างตาราง sku_preparation_area_mapping\n');

  // Query sample data to see structure
  const { data, error } = await supabase
    .from('sku_preparation_area_mapping')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Sample data from sku_preparation_area_mapping:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.length > 0) {
      console.log('\n📋 Available columns:');
      Object.keys(data[0]).forEach(col => {
        console.log(`  - ${col}`);
      });
    }
  }

  // Check preparation_area table
  console.log('\n🔍 ตรวจสอบตาราง preparation_area:');
  const { data: paData, error: paError } = await supabase
    .from('preparation_area')
    .select('*')
    .limit(3);

  if (paError) {
    console.error('❌ Error:', paError);
  } else {
    console.log('✅ Sample data from preparation_area:');
    console.log(JSON.stringify(paData, null, 2));
  }
}

checkMappingTable().catch(console.error);
