const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugTransfer() {
  const palletId = 'ATG2500016115';
  const destLocationCode = 'A01-01-002';

  console.log('=== Testing Transfer Validation ===');
  console.log(`Pallet: ${palletId}`);
  console.log(`Destination: ${destLocationCode}\n`);

  // 1. Get SKU from pallet
  const { data: balances } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, pallet_id, total_piece_qty')
    .or(`pallet_id.eq.${palletId},pallet_id_external.eq.${palletId}`)
    .gt('total_piece_qty', 0);

  console.log('1. Pallet Contents:');
  console.log(JSON.stringify(balances, null, 2));

  if (!balances || balances.length === 0) {
    console.log('❌ Pallet not found or has no stock');
    return;
  }

  const skuId = balances[0].sku_id;

  // 2. Get SKU's default_location
  const { data: skuData } = await supabase
    .from('master_sku')
    .select('sku_id, default_location')
    .eq('sku_id', skuId)
    .single();

  console.log('\n2. SKU Default Location:');
  console.log(JSON.stringify(skuData, null, 2));

  // 3. Check if destination is a picking home
  const { data: destPrepArea } = await supabase
    .from('preparation_area')
    .select('area_id, area_code, area_name')
    .eq('area_code', destLocationCode)
    .single();

  console.log('\n3. Destination Preparation Area:');
  console.log(JSON.stringify(destPrepArea, null, 2));

  // 4. Validation logic
  console.log('\n=== Validation Result ===');
  
  if (destPrepArea) {
    console.log(`✓ Destination ${destLocationCode} IS a picking home`);
    
    if (skuData && skuData.default_location) {
      console.log(`✓ SKU ${skuId} has default_location: ${skuData.default_location}`);
      
      if (skuData.default_location === destLocationCode) {
        console.log(`✅ ALLOW: Destination matches SKU's default_location`);
      } else {
        console.log(`❌ BLOCK: Destination (${destLocationCode}) does NOT match SKU's default_location (${skuData.default_location})`);
        console.log(`\nError message should be:`);
        console.log(`"❌ ไม่สามารถย้ายเข้า ${destLocationCode} ได้\n\nสินค้า ${skuId} มีบ้านหยิบที่กำหนดไว้ที่: ${skuData.default_location}\nไม่สามารถย้ายไปยังบ้านหยิบอื่นได้"`);
      }
    } else {
      console.log(`✓ SKU ${skuId} has NO default_location`);
      console.log(`✅ ALLOW: SKU can go to any picking home`);
    }
  } else {
    console.log(`✓ Destination ${destLocationCode} is NOT a picking home (bulk storage)`);
    console.log(`✅ ALLOW: Can move to bulk storage`);
  }
}

debugTransfer().catch(console.error);
