require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLedgerLocationIssue() {
  console.log('🔍 ตรวจสอบ ledger entries ที่มี UUID ใน location_id...\n');

  // ดึงข้อมูล ledger entries ที่มีปัญหา
  const { data: ledgers, error } = await supabase
    .from('wms_inventory_ledger')
    .select(`
      ledger_id,
      movement_at,
      transaction_type,
      direction,
      location_id,
      sku_id,
      move_item_id,
      pallet_id,
      pack_qty,
      piece_qty
    `)
    .in('ledger_id', [63890, 63888, 63886, 63884])
    .order('ledger_id', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 พบ ${ledgers.length} รายการ:\n`);
  
  for (const ledger of ledgers) {
    console.log(`Ledger ID: ${ledger.ledger_id}`);
    console.log(`  Transaction: ${ledger.transaction_type} (${ledger.direction})`);
    console.log(`  Location ID: ${ledger.location_id}`);
    console.log(`  SKU: ${ledger.sku_id}`);
    console.log(`  Pallet: ${ledger.pallet_id || '-'}`);
    console.log(`  Move Item ID: ${ledger.move_item_id || '-'}`);
    console.log(`  Quantity: ${ledger.pack_qty} แพ็ค, ${ledger.piece_qty} ชิ้น`);
    console.log(`  Time: ${new Date(ledger.movement_at).toLocaleString('th-TH')}`);
    
    // ตรวจสอบว่า location_id เป็น UUID หรือไม่
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ledger.location_id);
    console.log(`  Is UUID: ${isUUID ? '✅ ใช่' : '❌ ไม่ใช่'}`);
    
    // ถ้าเป็น UUID ให้หา location_name จาก master_location
    if (isUUID) {
      const { data: location } = await supabase
        .from('master_location')
        .select('location_id, location_name')
        .eq('location_id', ledger.location_id)
        .single();
      
      if (location) {
        console.log(`  ✅ พบ location: ${location.location_name}`);
      } else {
        console.log(`  ⚠️ ไม่พบ location ในตาราง master_location`);
      }
    }
    
    // ถ้ามี move_item_id ให้ตรวจสอบข้อมูลใน wms_move_items
    if (ledger.move_item_id) {
      const { data: moveItem } = await supabase
        .from('wms_move_items')
        .select('move_item_id, from_location_id, to_location_id')
        .eq('move_item_id', ledger.move_item_id)
        .single();
      
      if (moveItem) {
        console.log(`  Move Item Info:`);
        console.log(`    From: ${moveItem.from_location_id}`);
        console.log(`    To: ${moveItem.to_location_id}`);
      }
    }
    
    console.log('');
  }

  // ตรวจสอบว่ามี ledger entries อื่นที่มี UUID ใน location_id หรือไม่
  console.log('\n🔍 ตรวจสอบ ledger entries อื่นที่มี UUID pattern...\n');
  
  const { data: allLedgers, error: allError } = await supabase
    .from('wms_inventory_ledger')
    .select('ledger_id, location_id, transaction_type, direction')
    .not('location_id', 'is', null)
    .order('ledger_id', { ascending: false })
    .limit(1000);

  if (!allError && allLedgers) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const withUUID = allLedgers.filter(l => uuidPattern.test(l.location_id));
    
    console.log(`📊 พบ ${withUUID.length} รายการที่มี UUID ใน location_id จากทั้งหมด ${allLedgers.length} รายการ`);
    
    if (withUUID.length > 0) {
      console.log('\nตัวอย่าง 10 รายการแรก:');
      withUUID.slice(0, 10).forEach(l => {
        console.log(`  Ledger ${l.ledger_id}: ${l.transaction_type} (${l.direction}) - ${l.location_id}`);
      });
    }
  }
}

checkLedgerLocationIssue()
  .then(() => {
    console.log('\n✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
