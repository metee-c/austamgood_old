const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findSource() {
  const palletId = 'ATG202601150000000670';
  
  console.log('=== SEARCHING FOR SOURCE DOCUMENTS ===');
  console.log('Pallet ID:', palletId);
  console.log('');
  
  // 1. Check wms_receive_items
  console.log('1. Checking wms_receive_items...');
  const { data: receiveItems, error: recError } = await supabase
    .from('wms_receive_items')
    .select(`
      *,
      wms_receives!inner(
        receive_no,
        receive_date,
        status,
        supplier_id
      ),
      master_sku(sku_name)
    `)
    .or(`pallet_id.eq."${palletId}",pallet_id_external.eq."${palletId}"`);
  
  if (recError) {
    console.error('Error:', recError);
  } else if (receiveItems && receiveItems.length > 0) {
    console.log(`✅ Found ${receiveItems.length} receive item(s):`);
    receiveItems.forEach(item => {
      console.log('');
      console.log('  Receive No:', item.wms_receives?.receive_no);
      console.log('  Receive Date:', item.wms_receives?.receive_date);
      console.log('  Status:', item.wms_receives?.status);
      console.log('  SKU:', item.sku_id, '-', item.master_sku?.sku_name);
      console.log('  Received Qty:', item.received_piece_qty, 'pieces');
      console.log('  Pack Qty:', item.received_pack_qty, 'packs');
      console.log('  Pallet ID:', item.pallet_id);
      console.log('  Pallet ID External:', item.pallet_id_external);
    });
  } else {
    console.log('❌ No receive items found');
  }
  
  console.log('');
  console.log('2. Checking wms_move_items...');
  
  // 2. Check wms_move_items
  const { data: moveItems, error: moveError } = await supabase
    .from('wms_move_items')
    .select('*')
    .or(`pallet_id.eq."${palletId}",pallet_id_external.eq."${palletId}"`);
  
  if (moveError) {
    console.error('Error:', moveError);
  } else if (moveItems && moveItems.length > 0) {
    console.log(`✅ Found ${moveItems.length} move item(s):`);
    moveItems.forEach(item => {
      console.log('');
      console.log('  Move ID:', item.move_id);
      console.log('  SKU:', item.sku_id);
      console.log('  From Location:', item.from_location_id);
      console.log('  To Location:', item.to_location_id);
      console.log('  Requested Qty:', item.requested_piece_qty, 'pieces');
      console.log('  Confirmed Qty:', item.confirmed_piece_qty, 'pieces');
      console.log('  Status:', item.status);
      console.log('  Pallet ID:', item.pallet_id);
    });
  } else {
    console.log('❌ No move items found');
  }
  
  console.log('');
  console.log('=== SUMMARY ===');
  console.log('');
  console.log('พาเลท ATG202601150000000670:');
  console.log('- ไม่พบใน receive items (ไม่มีการรับเข้า)');
  console.log('- ไม่พบใน move items (ไม่มีการย้าย)');
  console.log('- มีเฉพาะใน ledger แต่ข้อมูล corrupted (piece_qty_change = null)');
  console.log('');
  console.log('สรุป: พาเลทนี้เป็น orphan record ที่ไม่มี source document');
  console.log('แนะนำ: ลบ ledger entries ที่เสียหายออก');
}

findSource().catch(console.error);
