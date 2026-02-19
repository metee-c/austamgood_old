const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAfterDelete() {
  const palletId = 'ATG202601150000000670';
  
  console.log('=== CHECKING PALLET AFTER DELETION ===');
  console.log('Pallet ID:', palletId);
  console.log('');
  
  // Check if there's any data left
  console.log('1. Checking wms_receive_items (original source)...');
  const { data: receiveItems, error: recError } = await supabase
    .from('wms_receive_items')
    .select(`
      *,
      wms_receives!inner(receive_no, receive_date, status)
    `)
    .or(`pallet_id.eq."${palletId}",pallet_id_external.eq."${palletId}"`);
  
  if (recError) {
    console.error('Error:', recError);
  } else if (receiveItems && receiveItems.length > 0) {
    console.log('✅ Found receive items! Can restore from here:');
    receiveItems.forEach(item => {
      console.log('');
      console.log('  Receive No:', item.wms_receives?.receive_no);
      console.log('  SKU:', item.sku_id);
      console.log('  Received Qty:', item.received_piece_qty, 'pieces');
      console.log('  Pack Qty:', item.received_pack_qty, 'packs');
      console.log('  Production Date:', item.production_date);
      console.log('  Expiry Date:', item.expiry_date);
      console.log('  Status:', item.wms_receives?.status);
    });
  } else {
    console.log('❌ No receive items found');
  }
  
  console.log('');
  console.log('2. Checking current location from last known data...');
  
  // Try to find from move history or other sources
  const { data: moves, error: moveError } = await supabase
    .from('wms_moves')
    .select(`
      *,
      wms_move_items!inner(*)
    `)
    .or(`wms_move_items.pallet_id.eq."${palletId}",wms_move_items.pallet_id_external.eq."${palletId}"`)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (moveError) {
    console.error('Error:', moveError);
  } else if (moves && moves.length > 0) {
    console.log('✅ Found move history:');
    const lastMove = moves[0];
    const moveItem = lastMove.wms_move_items?.[0];
    console.log('  Last Move:', lastMove.move_no);
    console.log('  From:', moveItem?.from_location_id);
    console.log('  To:', moveItem?.to_location_id);
    console.log('  Status:', lastMove.status);
  } else {
    console.log('❌ No move history found');
  }
  
  console.log('');
  console.log('=== RECOMMENDATION ===');
  console.log('');
  
  if (receiveItems && receiveItems.length > 0) {
    const item = receiveItems[0];
    console.log('✅ พบข้อมูลต้นทาง สามารถกู้คืนได้!');
    console.log('');
    console.log('ข้อมูลที่ต้องใช้:');
    console.log('- SKU:', item.sku_id);
    console.log('- Quantity:', item.received_piece_qty, 'pieces');
    console.log('- Pack Qty:', item.received_pack_qty, 'packs');
    console.log('- Production Date:', item.production_date);
    console.log('- Expiry Date:', item.expiry_date);
    console.log('');
    console.log('จะสร้าง script กู้คืนและย้ายไป PK001');
  } else {
    console.log('❌ ไม่พบข้อมูลต้นทาง ไม่สามารถกู้คืนได้');
    console.log('ต้องถามผู้ใช้ว่าพาเลทนี้มีสินค้าอะไร จำนวนเท่าไร');
  }
}

checkAfterDelete().catch(console.error);
