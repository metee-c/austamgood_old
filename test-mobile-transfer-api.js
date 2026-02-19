const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMobileTransferAPI() {
  const palletId = 'ATG202601150000000670';
  
  console.log('=== TESTING MOBILE TRANSFER API ===');
  console.log('Searching for pallet:', palletId);
  console.log('');
  
  // This simulates what the mobile transfer page does
  const { data, error } = await supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      master_sku (
        sku_id,
        sku_name,
        weight_per_piece_kg,
        default_location
      ),
      master_location (
        location_id,
        location_code,
        location_name,
        location_type,
        zone
      )
    `)
    .gt('total_piece_qty', 0)
    .or(`pallet_id.eq."${palletId}",pallet_id_external.eq."${palletId}"`)
    .order('sku_id', { ascending: true })
    .order('production_date', { ascending: true });

  if (error) {
    console.error('❌ API Error:', error);
    return;
  }

  console.log('=== SEARCH RESULTS ===');
  console.log('Found', data?.length || 0, 'result(s)');
  console.log('');
  
  if (data && data.length > 0) {
    data.forEach((item, i) => {
      console.log(`Result ${i + 1}:`);
      console.log('  Pallet ID:', item.pallet_id);
      console.log('  SKU:', item.sku_id, '-', item.master_sku?.sku_name);
      console.log('  Current Location:', item.master_location?.location_code, '-', item.master_location?.location_name);
      console.log('  Quantity:', item.total_piece_qty, 'pieces');
      console.log('  Pack Qty:', item.total_pack_qty, 'packs');
      console.log('  Production Date:', item.production_date);
      console.log('  Expiry Date:', item.expiry_date);
      console.log('');
    });
    
    console.log('✅ SUCCESS! พาเลทสามารถค้นหาได้ที่หน้า mobile transfer');
    console.log('✅ ตอนนี้สามารถย้ายพาเลทนี้ไปยังโลเคชั่นอื่นได้แล้ว');
  } else {
    console.log('❌ FAILED! ไม่พบพาเลทในระบบ');
  }
}

testMobileTransferAPI().catch(console.error);
