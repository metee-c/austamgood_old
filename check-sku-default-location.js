/**
 * Check SKU default_location for B-BAP-C|WEP|030
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSku() {
  console.log('=== Checking SKU B-BAP-C|WEP|030 ===\n');

  const { data: sku, error } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, default_location')
    .eq('sku_id', 'B-BAP-C|WEP|030')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('SKU Data:');
  console.log(JSON.stringify(sku, null, 2));
  console.log('');
  console.log(`default_location: ${sku.default_location}`);
}

checkSku().catch(console.error);
