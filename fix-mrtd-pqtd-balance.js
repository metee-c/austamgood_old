// Fix MRTD และ PQTD balance ให้ตรงกับ Ledger
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APPLY_FIX = process.argv.includes('--apply');

async function fixMRTDPQTDBalance() {
  console.log('🔧 Fix MRTD/PQTD Balance ให้ตรงกับ Ledger');
  console.log(`🔸 Mode: ${APPLY_FIX ? '✅ APPLY' : '🔍 DRY RUN (ใช้ --apply เพื่อแก้ไขจริง)'}`);
  console.log('='.repeat(100));

  // ========================================
  // 1. คำนวณ expected balance จาก Ledger ทั้งหมด (ไม่จำกัดวันที่)
  // ========================================
  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('sku_id, location_id, piece_qty, direction')
    .in('location_id', ['MRTD', 'PQTD']);

  if (ledgerError) {
    console.log('❌ Error loading ledger:', ledgerError.message);
    return;
  }

  // คำนวณ expected balance จาก ledger
  const expectedBalance = {}; // key: `${location_id}|${sku_id}`, value: piece_qty

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

  console.log(`\n📝 Ledger entries: ${(ledgerEntries || []).length} รายการ`);
  console.log(`📊 SKUs ที่มี activity: ${Object.keys(expectedBalance).length} รายการ`);

  // ========================================
  // 2. ดึง current balance จาก wms_inventory_balances
  // ========================================
  const { data: currentBalances, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, location_id, total_piece_qty, reserved_piece_qty')
    .in('location_id', ['MRTD', 'PQTD']);

  if (balanceError) {
    console.log('❌ Error loading balances:', balanceError.message);
    return;
  }

  // Map current balances
  const currentBalanceMap = {}; // key: `${location_id}|${sku_id}`, value: balance record

  (currentBalances || []).forEach(b => {
    const key = `${b.location_id}|${b.sku_id}`;
    // ถ้ามีหลาย record ให้รวมกัน
    if (!currentBalanceMap[key]) {
      currentBalanceMap[key] = { ...b, records: [b] };
    } else {
      currentBalanceMap[key].total_piece_qty += parseFloat(b.total_piece_qty) || 0;
      currentBalanceMap[key].records.push(b);
    }
  });

  console.log(`💰 Balance records: ${(currentBalances || []).length} รายการ`);

  // ========================================
  // 3. เปรียบเทียบและหา mismatches
  // ========================================
  const allKeys = new Set([...Object.keys(expectedBalance), ...Object.keys(currentBalanceMap)]);

  const mismatches = [];
  const toCreate = [];
  const toUpdate = [];
  const toDelete = [];

  allKeys.forEach(key => {
    const expected = expectedBalance[key];
    const current = currentBalanceMap[key];
    const expectedQty = expected?.qty || 0;
    const currentQty = parseFloat(current?.total_piece_qty) || 0;

    if (Math.abs(expectedQty - currentQty) > 0.001) { // tolerance for float comparison
      const [location_id, sku_id] = key.split('|');

      if (!current && expectedQty > 0) {
        // ต้องสร้าง balance ใหม่
        toCreate.push({ location_id, sku_id, expected_qty: expectedQty });
      } else if (current && expectedQty === 0) {
        // ต้องลบ balance (หรือ set เป็น 0)
        toDelete.push({ ...current, expected_qty: 0 });
      } else if (current) {
        // ต้อง update balance
        toUpdate.push({ ...current, expected_qty: expectedQty });
      }

      mismatches.push({
        location_id,
        sku_id,
        current_qty: currentQty,
        expected_qty: expectedQty,
        diff: expectedQty - currentQty
      });
    }
  });

  console.log(`\n❌ Mismatches found: ${mismatches.length} รายการ`);
  console.log(`   - ต้องสร้างใหม่: ${toCreate.length}`);
  console.log(`   - ต้อง update: ${toUpdate.length}`);
  console.log(`   - ต้องลบ/set=0: ${toDelete.length}`);

  // ========================================
  // 4. แสดงรายละเอียด mismatches
  // ========================================
  if (mismatches.length > 0) {
    console.log('\n' + '-'.repeat(100));
    console.log(
      'Location'.padEnd(10) +
      'SKU'.padEnd(30) +
      'Current'.padEnd(12) +
      'Expected'.padEnd(12) +
      'Diff'.padEnd(12) +
      'Action'
    );
    console.log('-'.repeat(100));

    mismatches.forEach(m => {
      let action = 'update';
      if (m.current_qty === 0 && m.expected_qty > 0) action = 'create';
      if (m.expected_qty === 0) action = 'delete';

      console.log(
        String(m.location_id).padEnd(10) +
        String(m.sku_id).substring(0, 28).padEnd(30) +
        String(m.current_qty).padEnd(12) +
        String(m.expected_qty).padEnd(12) +
        String(m.diff > 0 ? '+' + m.diff : m.diff).padEnd(12) +
        action
      );
    });
  }

  // ========================================
  // 5. Apply fixes (ถ้า --apply)
  // ========================================
  if (APPLY_FIX && mismatches.length > 0) {
    console.log('\n' + '='.repeat(100));
    console.log('🔧 กำลังแก้ไข...');

    let fixedCount = 0;
    let errorCount = 0;

    // Update existing records
    for (const item of toUpdate) {
      // Update first record, delete duplicates if any
      const mainRecord = item.records[0];
      const { error: updateError } = await supabase
        .from('wms_inventory_balances')
        .update({ total_piece_qty: item.expected_qty })
        .eq('balance_id', mainRecord.balance_id);

      if (updateError) {
        console.log(`❌ Error updating ${item.sku_id}: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`✅ Updated ${item.location_id}/${item.sku_id}: ${mainRecord.total_piece_qty} → ${item.expected_qty}`);
        fixedCount++;
      }

      // Delete duplicate records if any
      if (item.records.length > 1) {
        for (let i = 1; i < item.records.length; i++) {
          const { error: deleteError } = await supabase
            .from('wms_inventory_balances')
            .delete()
            .eq('balance_id', item.records[i].balance_id);

          if (!deleteError) {
            console.log(`   🗑️ Deleted duplicate record ${item.records[i].balance_id}`);
          }
        }
      }
    }

    // Set to 0 for records that should be empty
    for (const item of toDelete) {
      for (const record of item.records) {
        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({ total_piece_qty: 0 })
          .eq('balance_id', record.balance_id);

        if (updateError) {
          console.log(`❌ Error zeroing ${item.sku_id}: ${updateError.message}`);
          errorCount++;
        } else {
          console.log(`✅ Zeroed ${item.location_id}/${item.sku_id}: ${record.total_piece_qty} → 0`);
          fixedCount++;
        }
      }
    }

    // Create new records
    for (const item of toCreate) {
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
    }

    console.log('\n' + '='.repeat(100));
    console.log(`📊 สรุป: แก้ไขสำเร็จ ${fixedCount} รายการ, Error ${errorCount} รายการ`);
  } else if (!APPLY_FIX && mismatches.length > 0) {
    console.log('\n⚠️ ใช้ --apply เพื่อแก้ไขจริง');
  } else {
    console.log('\n✅ ไม่มี mismatch ที่ต้องแก้ไข');
  }

  console.log('='.repeat(100));
}

fixMRTDPQTDBalance().catch(console.error);
