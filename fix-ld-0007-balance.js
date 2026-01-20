// Fix balance สำหรับ LD-20260120-0007
// ปัญหา: Ledger IN มี qty 6,956 แต่ Balance = 0
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APPLY_FIX = process.argv.includes('--apply');

async function fixLD0007Balance() {
  console.log('🔧 Fix Balance สำหรับ LD-20260120-0007');
  console.log(`🔸 Mode: ${APPLY_FIX ? '✅ APPLY' : '🔍 DRY RUN (ใช้ --apply เพื่อแก้ไขจริง)'}`);
  console.log('='.repeat(100));

  // ========================================
  // 1. คำนวณ expected balance จาก Ledger ที่เกี่ยวกับ BFS นี้
  // ========================================
  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('sku_id, location_id, piece_qty, direction')
    .in('location_id', ['MRTD', 'PQTD'])
    .or('reference_no.ilike.%BFS-20260119-002%,reference_no.ilike.%BFS-20260113-003%');

  if (ledgerError) {
    console.log('❌ Error loading ledger:', ledgerError.message);
    return;
  }

  // คำนวณ expected balance
  const expectedBalance = {};

  (ledgerEntries || []).forEach(entry => {
    const key = `${entry.location_id}|${entry.sku_id}`;
    if (!expectedBalance[key]) {
      expectedBalance[key] = { location_id: entry.location_id, sku_id: entry.sku_id, qty: 0 };
    }
    if (entry.direction === 'in') {
      expectedBalance[key].qty += parseFloat(entry.piece_qty) || 0;
    } else if (entry.direction === 'out') {
      expectedBalance[key].qty -= parseFloat(entry.piece_qty) || 0;
    }
  });

  console.log(`\n📝 Ledger entries สำหรับ BFS-20260119-002, BFS-20260113-003: ${(ledgerEntries || []).length} รายการ`);

  // กรองเฉพาะที่ควรมี balance > 0
  const shouldHaveBalance = Object.values(expectedBalance).filter(e => e.qty > 0);
  console.log(`📊 SKUs ที่ควรมี balance > 0: ${shouldHaveBalance.length} รายการ`);

  if (shouldHaveBalance.length === 0) {
    console.log('\n✅ ไม่มี SKU ที่ควรมี balance (อาจจะถูกโหลดไปแล้ว)');
    return;
  }

  // ========================================
  // 2. ดึง current balance
  // ========================================
  const skuLocationKeys = shouldHaveBalance.map(e => ({ location_id: e.location_id, sku_id: e.sku_id }));

  const { data: currentBalances, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, location_id, total_piece_qty')
    .in('location_id', ['MRTD', 'PQTD']);

  if (balanceError) {
    console.log('❌ Error loading balances:', balanceError.message);
    return;
  }

  // Map current balances
  const currentBalanceMap = {};
  (currentBalances || []).forEach(b => {
    const key = `${b.location_id}|${b.sku_id}`;
    if (!currentBalanceMap[key]) {
      currentBalanceMap[key] = [];
    }
    currentBalanceMap[key].push(b);
  });

  // ========================================
  // 3. แสดงรายละเอียดและ fix
  // ========================================
  console.log('\n' + '-'.repeat(100));
  console.log(
    'Location'.padEnd(10) +
    'SKU'.padEnd(30) +
    'Current'.padEnd(12) +
    'Expected'.padEnd(12) +
    'Action'
  );
  console.log('-'.repeat(100));

  const toFix = [];

  shouldHaveBalance.forEach(expected => {
    const key = `${expected.location_id}|${expected.sku_id}`;
    const currentRecords = currentBalanceMap[key] || [];
    const currentQty = currentRecords.reduce((sum, r) => sum + (parseFloat(r.total_piece_qty) || 0), 0);
    const expectedQty = expected.qty;

    const action = currentRecords.length === 0 ? 'create' : (currentQty === expectedQty ? 'ok' : 'update');

    console.log(
      String(expected.location_id).padEnd(10) +
      String(expected.sku_id).substring(0, 28).padEnd(30) +
      String(currentQty).padEnd(12) +
      String(expectedQty).padEnd(12) +
      (action === 'ok' ? '✅' : action)
    );

    if (action !== 'ok') {
      toFix.push({
        location_id: expected.location_id,
        sku_id: expected.sku_id,
        current_qty: currentQty,
        expected_qty: expectedQty,
        action,
        records: currentRecords
      });
    }
  });

  console.log('-'.repeat(100));
  console.log(`📊 ต้อง fix: ${toFix.length} รายการ`);

  // ========================================
  // 4. Apply fixes
  // ========================================
  if (APPLY_FIX && toFix.length > 0) {
    console.log('\n🔧 กำลังแก้ไข...');

    let fixedCount = 0;
    let errorCount = 0;

    for (const item of toFix) {
      if (item.action === 'create') {
        // สร้าง balance ใหม่
        const { error: insertError } = await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: 'WH-001',
            location_id: item.location_id,
            sku_id: item.sku_id,
            total_piece_qty: item.expected_qty,
            reserved_piece_qty: 0
          });

        if (insertError) {
          console.log(`❌ Error creating ${item.sku_id}: ${insertError.message}`);
          errorCount++;
        } else {
          console.log(`✅ Created ${item.location_id}/${item.sku_id}: ${item.expected_qty}`);
          fixedCount++;
        }
      } else if (item.action === 'update') {
        // Update existing record
        const mainRecord = item.records[0];
        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({ total_piece_qty: item.expected_qty })
          .eq('balance_id', mainRecord.balance_id);

        if (updateError) {
          console.log(`❌ Error updating ${item.sku_id}: ${updateError.message}`);
          errorCount++;
        } else {
          console.log(`✅ Updated ${item.location_id}/${item.sku_id}: ${item.current_qty} → ${item.expected_qty}`);
          fixedCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log(`📊 สรุป: แก้ไขสำเร็จ ${fixedCount} รายการ, Error ${errorCount} รายการ`);
  } else if (!APPLY_FIX && toFix.length > 0) {
    console.log('\n⚠️ ใช้ --apply เพื่อแก้ไขจริง');

    // แสดงสรุป qty ที่จะ fix
    const totalExpected = toFix.reduce((sum, item) => sum + item.expected_qty, 0);
    console.log(`📦 รวม qty ที่ต้องเพิ่ม: ${totalExpected}`);
  }

  console.log('='.repeat(100));
}

fixLD0007Balance().catch(console.error);
