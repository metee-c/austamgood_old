// Find SKU by name pattern
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findSKU() {
  console.log('🔍 Searching for SKU with name containing "Buzz Natural Care สุนัขโต แกะ เม็ดเล็ก"');
  console.log('='.repeat(80));
  
  const { data: skus, error } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, default_location')
    .ilike('sku_name', '%Buzz Natural Care%แกะ%เม็ดเล็ก%');
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (skus.length === 0) {
    console.log('⚠️ No SKUs found');
    
    // Try broader search
    console.log('\n🔍 Trying broader search: "Buzz Natural Care"');
    const { data: skus2, error: error2 } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, default_location')
      .ilike('sku_name', '%Buzz Natural Care%');
    
    if (error2) {
      console.error('❌ Error:', error2);
      return;
    }
    
    console.log(`\n✅ Found ${skus2.length} SKU(s):`);
    skus2.forEach(sku => {
      console.log(`\nSKU ID: ${sku.sku_id}`);
      console.log(`Name: ${sku.sku_name}`);
      console.log(`default_location: ${sku.default_location || '(NULL)'}`);
    });
  } else {
    console.log(`✅ Found ${skus.length} SKU(s):`);
    skus.forEach(sku => {
      console.log(`\nSKU ID: ${sku.sku_id}`);
      console.log(`Name: ${sku.sku_name}`);
      console.log(`default_location: ${sku.default_location || '(NULL)'}`);
    });
  }
}

findSKU().catch(console.error);
