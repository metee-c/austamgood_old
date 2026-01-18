const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSettlement() {
  console.log('🔍 ตรวจสอบการ Settle Virtual Pallet หลังเติม ATG20260112000000071\n');

  const PALLET_ID = 'ATG20260112000000071';
  const SKU_ID = 'B-NET-C|FNC|010';
  const LOCATION_ID = 'PK001';

  // 1. เช็คพาเลทที่เติม
  console.log('📦 ข้อมูลพาเลทที่เติม:');
  const { data: pallet } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', PALLET_ID)
    .eq('sku_id', SKU_ID)
    .single();

  if (!pallet) {
    console.log('   ❌ ไม่พบพาเลท ATG20260112000000071 ในระบบ');
    console.log('   กรุณาตรวจสอบว่าเติมสินค้าเข้าระบบแล้วหรือยัง\n');
    return;
  }

  console.log(`   Pallet ID: ${pallet.pallet_id}`);
  console.log(`   Location: ${pallet.location_id}`);
  console.log(`   SKU: ${pallet.sku_id}`);
  console.log(`   Total: ${pallet.total_piece_qty} ชิ้น`);
  console.log(`   Reserved: ${pallet.reserved_piece_qty} ชิ้น`);
  console.log(`   Available: ${pallet.total_piece_qty - pallet.reserved_piece_qty} ชิ้น`);
  console.log(`   Created: ${new Date(pallet.created_at).toLocaleString('th-TH')}`);
  console.log(`   Updated: ${new Date(pallet.updated_at).toLocaleString('th-TH')}\n`);

  // 2. เช็ค Virtual Pallet
  console.log('🔹 สถานะ Virtual Pallet:');
  const { data: virtualPallet } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', `VIRTUAL-${LOCATION_ID}-${SKU_ID}`)
    .single();

  if (virtualPallet) {
    console.log(`   Virtual Pallet: ${virtualPallet.pallet_id}`);
    console.log(`   Total: ${virtualPallet.total_piece_qty} ชิ้น`);
    console.log(`   Reserved: ${virtualPallet.reserved_piece_qty} ชิ้น`);
    console.log(`   Deficit: ${Math.abs(virtualPallet.total_piece_qty)} ชิ้น (ติดลบ)`);
    console.log(`   Updated: ${new Date(virtualPallet.updated_at).toLocaleString('th-TH')}\n`);
  } else {
    console.log('   ✅ ไม่พบ Virtual Pallet (อาจ settle หมดแล้ว)\n');
  }

  // 3. เช็ค Settlement History
  console.log('📜 Settlement History:');
  const { data: settlements } = await supabase
    .from('virtual_pallet_settlements')
    .select('*')
    .eq('source_pallet_id', PALLET_ID)
    .order('settled_at', { ascending: false });

  if (settlements && settlements.length > 0) {
    console.log(`   ✅ พบ ${settlements.length} Settlement Record(s):\n`);
    
    settlements.forEach((s, idx) => {
      console.log(`   ${idx + 1}. Settlement ID: ${s.settlement_id}`);
      console.log(`      Virtual Pallet: ${s.virtual_pallet_id}`);
      console.log(`      Settled Qty: ${s.settled_piece_qty} ชิ้น`);
      console.log(`      Virtual Balance: ${s.virtual_balance_before} → ${s.virtual_balance_after}`);
      console.log(`      Settled At: ${new Date(s.settled_at).toLocaleString('th-TH')}`);
      console.log(`      Ledger IDs: in=${s.ledger_id_in}, out=${s.ledger_id_out}, virtual=${s.ledger_id_virtual}`);
      console.log('');
    });
  } else {
    console.log('   ⚠️  ไม่พบ Settlement Record');
    console.log('   → Trigger อาจไม่ทำงาน หรือไม่มี Virtual Pallet ที่ต้อง settle\n');
  }

  // 4. เช็ค Ledger Entries
  console.log('📝 Ledger Entries ที่เกี่ยวข้อง:');
  
  // 4.1 Ledger ของพาเลทที่เติม
  const { data: palletLedgers } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('pallet_id', PALLET_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\n   🔸 Ledger ของพาเลท ${PALLET_ID}:`);
  if (palletLedgers && palletLedgers.length > 0) {
    palletLedgers.forEach(l => {
      console.log(`      - ${l.transaction_type} (${l.direction}): ${l.piece_qty} ชิ้น`);
      console.log(`        ${l.remarks || 'No remarks'}`);
      console.log(`        At: ${new Date(l.created_at).toLocaleString('th-TH')}`);
    });
  } else {
    console.log('      ไม่พบ Ledger');
  }

  // 4.2 Ledger VIRTUAL_SETTLE
  const { data: settleLedgers } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('sku_id', SKU_ID)
    .eq('location_id', LOCATION_ID)
    .eq('transaction_type', 'VIRTUAL_SETTLE')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\n   🔸 Ledger VIRTUAL_SETTLE ล่าสุด:`);
  if (settleLedgers && settleLedgers.length > 0) {
    settleLedgers.forEach(l => {
      console.log(`      - ${l.direction.toUpperCase()}: ${l.piece_qty} ชิ้น (${l.pallet_id})`);
      console.log(`        ${l.remarks}`);
      console.log(`        At: ${new Date(l.created_at).toLocaleString('th-TH')}`);
    });
  } else {
    console.log('      ไม่พบ Ledger VIRTUAL_SETTLE');
  }

  // 5. สรุป
  console.log('\n' + '='.repeat(70));
  console.log('📊 สรุปผลการตรวจสอบ:');
  console.log('='.repeat(70));

  if (settlements && settlements.length > 0) {
    const totalSettled = settlements.reduce((sum, s) => sum + parseFloat(s.settled_piece_qty), 0);
    console.log(`\n✅ Trigger ทำงานสำเร็จ!`);
    console.log(`   - พบ Settlement Record: ${settlements.length} รายการ`);
    console.log(`   - จำนวนที่ Settle: ${totalSettled} ชิ้น`);
    console.log(`   - Virtual Pallet ปัจจุบัน: ${virtualPallet ? `ติดลบ ${Math.abs(virtualPallet.total_piece_qty)} ชิ้น` : 'Settled หมดแล้ว'}`);
    console.log(`   - พาเลทที่เติมเหลือ: ${pallet.total_piece_qty} ชิ้น (Available: ${pallet.total_piece_qty - pallet.reserved_piece_qty})`);
  } else {
    console.log(`\n⚠️  ไม่พบการ Settle`);
    
    if (!virtualPallet) {
      console.log(`   → ไม่มี Virtual Pallet ที่ต้อง settle (อาจ settle หมดก่อนหน้านี้แล้ว)`);
    } else {
      console.log(`   → Virtual Pallet ยังติดลบอยู่ ${Math.abs(virtualPallet.total_piece_qty)} ชิ้น`);
      console.log(`   → Trigger อาจไม่ทำงาน - ตรวจสอบ:`);
      console.log(`      1. Ledger entry มี direction = 'in' หรือไม่`);
      console.log(`      2. Location เป็น Prep Area หรือไม่`);
      console.log(`      3. Trigger ถูก enable หรือไม่`);
    }
  }

  console.log('\n✅ เสร็จสิ้น');
}

checkSettlement().catch(console.error);
