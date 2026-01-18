const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findPallet() {
  console.log('🔍 ค้นหาพาเลท ATG20260112000000071 ในระบบ...\n');

  const PALLET_ID = 'ATG20260112000000071';

  // 1. ค้นหาใน wms_inventory_balances
  console.log('📦 ค้นหาใน wms_inventory_balances:');
  const { data: balances } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', PALLET_ID);

  if (balances && balances.length > 0) {
    console.log(`   ✅ พบ ${balances.length} record(s):\n`);
    balances.forEach(b => {
      console.log(`   - Balance ID: ${b.balance_id}`);
      console.log(`     Location: ${b.location_id}`);
      console.log(`     SKU: ${b.sku_id}`);
      console.log(`     Total: ${b.total_piece_qty} ชิ้น`);
      console.log(`     Reserved: ${b.reserved_piece_qty} ชิ้น`);
      console.log(`     Created: ${new Date(b.created_at).toLocaleString('th-TH')}`);
      console.log('');
    });
  } else {
    console.log('   ❌ ไม่พบใน wms_inventory_balances\n');
  }

  // 2. ค้นหาใน wms_inventory_ledger
  console.log('📝 ค้นหาใน wms_inventory_ledger:');
  const { data: ledgers } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('pallet_id', PALLET_ID)
    .order('created_at', { ascending: false });

  if (ledgers && ledgers.length > 0) {
    console.log(`   ✅ พบ ${ledgers.length} ledger entry(s):\n`);
    ledgers.forEach(l => {
      console.log(`   - Ledger ID: ${l.ledger_id}`);
      console.log(`     Type: ${l.transaction_type} (${l.direction})`);
      console.log(`     Location: ${l.location_id}`);
      console.log(`     SKU: ${l.sku_id}`);
      console.log(`     Qty: ${l.piece_qty} ชิ้น`);
      console.log(`     Remarks: ${l.remarks || 'No remarks'}`);
      console.log(`     Created: ${new Date(l.created_at).toLocaleString('th-TH')}`);
      console.log('');
    });
  } else {
    console.log('   ❌ ไม่พบใน wms_inventory_ledger\n');
  }

  // 3. ค้นหาใน wms_receives (ใบรับสินค้า)
  console.log('📥 ค้นหาใน wms_receives:');
  const { data: receives } = await supabase
    .from('wms_receives')
    .select('*')
    .eq('pallet_id', PALLET_ID);

  if (receives && receives.length > 0) {
    console.log(`   ✅ พบ ${receives.length} receive(s):\n`);
    receives.forEach(r => {
      console.log(`   - Receive ID: ${r.receive_id}`);
      console.log(`     Receive No: ${r.receive_no}`);
      console.log(`     SKU: ${r.sku_id}`);
      console.log(`     Location: ${r.location_id}`);
      console.log(`     Qty: ${r.received_qty} ชิ้น`);
      console.log(`     Status: ${r.status}`);
      console.log(`     Created: ${new Date(r.created_at).toLocaleString('th-TH')}`);
      console.log('');
    });
  } else {
    console.log('   ❌ ไม่พบใน wms_receives\n');
  }

  // 4. ค้นหาพาเลทที่คล้ายกัน
  console.log('🔎 ค้นหาพาเลทที่คล้ายกัน (ATG202601120000000%)');
  const { data: similarPallets } = await supabase
    .from('wms_inventory_balances')
    .select('pallet_id, location_id, sku_id, total_piece_qty, created_at')
    .like('pallet_id', 'ATG202601120000000%')
    .order('created_at', { ascending: false })
    .limit(10);

  if (similarPallets && similarPallets.length > 0) {
    console.log(`   ✅ พบ ${similarPallets.length} พาเลทที่คล้ายกัน:\n`);
    similarPallets.forEach(p => {
      console.log(`   - ${p.pallet_id}`);
      console.log(`     Location: ${p.location_id}, SKU: ${p.sku_id}`);
      console.log(`     Qty: ${p.total_piece_qty}, Created: ${new Date(p.created_at).toLocaleString('th-TH')}`);
      console.log('');
    });
  } else {
    console.log('   ❌ ไม่พบพาเลทที่คล้ายกัน\n');
  }

  // 5. เช็ค Virtual Pallet ของ B-NET-C|FNC|010
  console.log('🔹 สถานะ Virtual Pallet B-NET-C|FNC|010:');
  const { data: virtual } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', 'VIRTUAL-PK001-B-NET-C|FNC|010')
    .single();

  if (virtual) {
    console.log(`   Total: ${virtual.total_piece_qty} ชิ้น (ติดลบ)`);
    console.log(`   Reserved: ${virtual.reserved_piece_qty} ชิ้น`);
    console.log(`   Deficit: ${Math.abs(virtual.total_piece_qty)} ชิ้น`);
    console.log(`   Updated: ${new Date(virtual.updated_at).toLocaleString('th-TH')}\n`);
  } else {
    console.log('   ✅ ไม่พบ Virtual Pallet (settle หมดแล้ว)\n');
  }

  console.log('✅ เสร็จสิ้น');
}

findPallet().catch(console.error);
