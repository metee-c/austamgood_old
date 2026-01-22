require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPallet() {
  const palletId = 'ATG20260122000000039';
  
  console.log(`\n🔍 ตรวจสอบ Pallet: ${palletId}\n`);
  
  // 1. Check wms_inventory_balances
  console.log('1️⃣ ตรวจสอบ wms_inventory_balances:');
  const { data: balances, error: balError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', palletId);
  
  if (balError) {
    console.error('❌ Error:', balError.message);
  } else if (!balances || balances.length === 0) {
    console.log('❌ ไม่พบ balance records');
  } else {
    console.log(`✅ พบ ${balances.length} balance records:`);
    balances.forEach(b => {
      console.log(`   - SKU: ${b.sku_id}, Location: ${b.location_id}, Qty: ${b.total_piece_qty} ชิ้น`);
    });
  }
  
  // 2. Check wms_inventory_ledger
  console.log('\n2️⃣ ตรวจสอบ wms_inventory_ledger:');
  const { data: ledgers, error: ledError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('pallet_id', palletId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (ledError) {
    console.error('❌ Error:', ledError.message);
  } else if (!ledgers || ledgers.length === 0) {
    console.log('❌ ไม่พบ ledger entries');
  } else {
    console.log(`✅ พบ ${ledgers.length} ledger entries (แสดง 10 รายการล่าสุด):`);
    ledgers.forEach(l => {
      console.log(`   - ${l.transaction_type}: ${l.quantity_change > 0 ? '+' : ''}${l.quantity_change} ชิ้น @ ${l.location_id} (${new Date(l.created_at).toLocaleString('th-TH')})`);
    });
  }
  
  // 3. Check wms_receives (ตรวจสอบว่ารับเข้ามาหรือไม่)
  console.log('\n3️⃣ ตรวจสอบ wms_receives:');
  const { data: receives, error: recError } = await supabase
    .from('wms_receives')
    .select(`
      receive_no,
      status,
      wms_receive_items!inner (
        pallet_id,
        sku_id,
        received_pack_qty,
        received_piece_qty
      )
    `)
    .eq('wms_receive_items.pallet_id', palletId);
  
  if (recError) {
    console.error('❌ Error:', recError.message);
  } else if (!receives || receives.length === 0) {
    console.log('❌ ไม่พบ receive records');
  } else {
    console.log(`✅ พบ ${receives.length} receive records:`);
    receives.forEach(r => {
      console.log(`   - Receive: ${r.receive_no}, Status: ${r.status}`);
      r.wms_receive_items.forEach(item => {
        console.log(`     • SKU: ${item.sku_id}, Qty: ${item.received_piece_qty} ชิ้น`);
      });
    });
  }
  
  // 4. Check wms_move_items (ตรวจสอบว่ามีการย้ายหรือไม่)
  console.log('\n4️⃣ ตรวจสอบ wms_move_items:');
  const { data: moves, error: moveError } = await supabase
    .from('wms_move_items')
    .select(`
      move_id,
      status,
      from_location_id,
      to_location_id,
      confirmed_piece_qty,
      wms_moves!inner (
        move_no,
        status
      )
    `)
    .eq('pallet_id', palletId)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (moveError) {
    console.error('❌ Error:', moveError.message);
  } else if (!moves || moves.length === 0) {
    console.log('❌ ไม่พบ move records');
  } else {
    console.log(`✅ พบ ${moves.length} move records:`);
    moves.forEach(m => {
      console.log(`   - Move: ${m.wms_moves.move_no}, ${m.from_location_id} → ${m.to_location_id}, Qty: ${m.confirmed_piece_qty} ชิ้น, Status: ${m.status}`);
    });
  }
  
  // 5. Summary
  console.log('\n📊 สรุป:');
  console.log(`   Balance Records: ${balances?.length || 0}`);
  console.log(`   Ledger Entries: ${ledgers?.length || 0}`);
  console.log(`   Receive Records: ${receives?.length || 0}`);
  console.log(`   Move Records: ${moves?.length || 0}`);
  
  if (!balances || balances.length === 0) {
    console.log('\n⚠️  ปัญหา: ไม่มี balance record → ต้องสร้างใหม่จาก ledger');
  }
}

checkPallet().catch(console.error);
