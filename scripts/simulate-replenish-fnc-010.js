const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function simulateReplenishment() {
  console.log('🔄 จำลองการเติมสินค้า B-NET-C|FNC|010 เข้า PK001\n');

  const SKU_ID = 'B-NET-C|FNC|010';
  const LOCATION_ID = 'PK001';
  const WAREHOUSE_ID = 'WH01';
  const REPLENISH_QTY = 150; // เติม 150 ชิ้น
  const PALLET_ID = 'TEST-REPLEN-' + Date.now();

  // 1. เช็คสถานะ Virtual Pallet ก่อนเติม
  console.log('📊 สถานะก่อนเติม:');
  const { data: virtualBefore } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', `VIRTUAL-${LOCATION_ID}-${SKU_ID}`)
    .single();

  if (virtualBefore) {
    console.log(`   Virtual Pallet: ${virtualBefore.pallet_id}`);
    console.log(`   Total: ${virtualBefore.total_piece_qty} ชิ้น (ติดลบ)`);
    console.log(`   Reserved: ${virtualBefore.reserved_piece_qty} ชิ้น`);
    console.log(`   Deficit: ${Math.abs(virtualBefore.total_piece_qty)} ชิ้น\n`);
  } else {
    console.log('   ❌ ไม่พบ Virtual Pallet (อาจไม่มีการจองหรือ settle หมดแล้ว)\n');
    return;
  }

  // 2. สร้าง Balance สำหรับพาเลทที่เติมเข้ามา
  console.log(`📦 สร้าง Balance สำหรับพาเลท ${PALLET_ID}...`);
  
  const { data: newBalance, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .insert({
      warehouse_id: WAREHOUSE_ID,
      location_id: LOCATION_ID,
      sku_id: SKU_ID,
      pallet_id: PALLET_ID,
      total_piece_qty: REPLENISH_QTY,
      total_pack_qty: REPLENISH_QTY / 12, // สมมติ qty_per_pack = 12
      reserved_piece_qty: 0,
      reserved_pack_qty: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (balanceError) {
    console.error('❌ Error creating balance:', balanceError);
    return;
  }

  console.log(`   ✅ สร้าง Balance สำเร็จ (balance_id: ${newBalance.balance_id})`);
  console.log(`   จำนวน: ${REPLENISH_QTY} ชิ้น\n`);

  // 3. สร้าง Ledger Entry (TRANSFER IN) - จะ trigger settlement
  console.log('📝 สร้าง Ledger Entry (TRANSFER IN)...');
  console.log('   ⏳ Trigger จะตรวจจับและ settle Virtual Pallet อัตโนมัติ...\n');

  const { data: ledger, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .insert({
      movement_at: new Date().toISOString(),
      transaction_type: 'TRANSFER',
      direction: 'in',
      warehouse_id: WAREHOUSE_ID,
      location_id: LOCATION_ID,
      sku_id: SKU_ID,
      pallet_id: PALLET_ID,
      pack_qty: REPLENISH_QTY / 12,
      piece_qty: REPLENISH_QTY,
      reference_no: 'TEST-REPLEN',
      remarks: `ทดสอบเติมสินค้าเพื่อ settle Virtual Pallet`,
      skip_balance_sync: false, // ให้ trigger ทำงาน
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (ledgerError) {
    console.error('❌ Error creating ledger:', ledgerError);
    return;
  }

  console.log(`   ✅ สร้าง Ledger สำเร็จ (ledger_id: ${ledger.ledger_id})\n`);

  // 4. รอ trigger ทำงาน (1 วินาที)
  console.log('⏳ รอ trigger settle Virtual Pallet...\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 5. เช็คสถานะหลังเติม
  console.log('📊 สถานะหลังเติม:\n');

  // 5.1 เช็ค Virtual Pallet
  const { data: virtualAfter } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', `VIRTUAL-${LOCATION_ID}-${SKU_ID}`)
    .single();

  console.log('   🔹 Virtual Pallet:');
  if (virtualAfter) {
    console.log(`      Total: ${virtualAfter.total_piece_qty} ชิ้น`);
    console.log(`      Reserved: ${virtualAfter.reserved_piece_qty} ชิ้น`);
    console.log(`      Change: ${virtualBefore.total_piece_qty} → ${virtualAfter.total_piece_qty}`);
    
    const settled = virtualBefore.total_piece_qty - virtualAfter.total_piece_qty;
    if (settled > 0) {
      console.log(`      ✅ Settled: ${settled} ชิ้น`);
    }
  }

  // 5.2 เช็คพาเลทที่เติม
  const { data: palletAfter } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('balance_id', newBalance.balance_id)
    .single();

  console.log(`\n   🔹 พาเลทที่เติม (${PALLET_ID}):`);
  if (palletAfter) {
    console.log(`      Total: ${palletAfter.total_piece_qty} ชิ้น`);
    console.log(`      Reserved: ${palletAfter.reserved_piece_qty} ชิ้น`);
    console.log(`      Available: ${palletAfter.total_piece_qty - palletAfter.reserved_piece_qty} ชิ้น`);
    console.log(`      Change: ${REPLENISH_QTY} → ${palletAfter.total_piece_qty}`);
    
    const used = REPLENISH_QTY - palletAfter.total_piece_qty;
    if (used > 0) {
      console.log(`      ✅ ถูกใช้ไป settle: ${used} ชิ้น`);
    }
  }

  // 5.3 เช็ค Settlement History
  const { data: settlements } = await supabase
    .from('virtual_pallet_settlements')
    .select('*')
    .eq('virtual_pallet_id', `VIRTUAL-${LOCATION_ID}-${SKU_ID}`)
    .eq('source_pallet_id', PALLET_ID)
    .order('settled_at', { ascending: false })
    .limit(1);

  console.log('\n   🔹 Settlement Record:');
  if (settlements && settlements.length > 0) {
    const s = settlements[0];
    console.log(`      ✅ พบ Settlement Record!`);
    console.log(`      Settlement ID: ${s.settlement_id}`);
    console.log(`      Settled Qty: ${s.settled_piece_qty} ชิ้น`);
    console.log(`      Virtual Balance: ${s.virtual_balance_before} → ${s.virtual_balance_after}`);
    console.log(`      Settled At: ${new Date(s.settled_at).toLocaleString('th-TH')}`);
  } else {
    console.log(`      ⚠️  ไม่พบ Settlement Record`);
  }

  // 5.4 เช็ค Ledger Entries ที่เกี่ยวข้อง
  const { data: ledgers } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('sku_id', SKU_ID)
    .eq('location_id', LOCATION_ID)
    .eq('transaction_type', 'VIRTUAL_SETTLE')
    .order('created_at', { ascending: false })
    .limit(2);

  console.log('\n   🔹 Ledger Entries (VIRTUAL_SETTLE):');
  if (ledgers && ledgers.length > 0) {
    ledgers.forEach(l => {
      console.log(`      - ${l.direction.toUpperCase()}: ${l.piece_qty} ชิ้น (${l.pallet_id})`);
      console.log(`        ${l.remarks}`);
    });
  } else {
    console.log(`      ⚠️  ไม่พบ Ledger VIRTUAL_SETTLE`);
  }

  // 6. สรุป
  console.log('\n' + '='.repeat(60));
  console.log('📊 สรุปผลการทดสอบ:');
  console.log('='.repeat(60));
  
  const deficit_before = Math.abs(virtualBefore.total_piece_qty);
  const deficit_after = virtualAfter ? Math.abs(virtualAfter.total_piece_qty) : 0;
  const settled_qty = deficit_before - deficit_after;

  console.log(`\n✅ Virtual Pallet ก่อนเติม: ติดลบ ${deficit_before} ชิ้น`);
  console.log(`✅ เติมสินค้าเข้า: ${REPLENISH_QTY} ชิ้น`);
  console.log(`✅ Settled: ${settled_qty} ชิ้น`);
  console.log(`✅ Virtual Pallet หลังเติม: ติดลบ ${deficit_after} ชิ้น`);
  console.log(`✅ พาเลทที่เติมเหลือ: ${palletAfter.total_piece_qty} ชิ้น`);

  if (settled_qty > 0) {
    console.log(`\n🎉 Trigger ทำงานสำเร็จ! Virtual Pallet ถูก settle อัตโนมัติ ${settled_qty} ชิ้น`);
  } else {
    console.log(`\n⚠️  Trigger ไม่ทำงาน - ตรวจสอบ trigger configuration`);
  }

  console.log('\n✅ เสร็จสิ้น');
}

simulateReplenishment().catch(console.error);
