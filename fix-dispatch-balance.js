// แก้ไข Dispatch Balance ให้ตรงกับงานที่หยิบวันนี้
// วิเคราะห์และแก้ไขความไม่ตรงกัน
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeAndFix() {
  const today = new Date().toISOString().split('T')[0];
  console.log('🔧 วิเคราะห์และแก้ไข Dispatch Balance');
  console.log(`📅 วันที่: ${today}`);
  console.log('='.repeat(100));

  // ========================================
  // 1. ดึงข้อมูล Dispatch Balance ปัจจุบัน
  // ========================================
  const { data: dispatchBalances, error: dispatchError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('location_id', 'Dispatch');

  if (dispatchError) {
    console.log('❌ Error:', dispatchError.message);
    return;
  }

  console.log(`\n📦 Dispatch Balances ปัจจุบัน: ${dispatchBalances.length} records`);

  // ========================================
  // 2. ดึง Picklist items ที่หยิบวันนี้ (ยังไม่โหลด)
  // ========================================
  const { data: picklistItems } = await supabase
    .from('picklist_items')
    .select(`
      id, sku_id, quantity_picked, status, picked_at,
      picklists!inner(id, picklist_code, status)
    `)
    .eq('status', 'picked')
    .gte('picked_at', today + 'T00:00:00')
    .lt('picked_at', today + 'T23:59:59');

  const pickedPicklistItems = (picklistItems || []).filter(item =>
    item.picklists?.status === 'completed'
  );

  // ========================================
  // 3. ดึง Face Sheet items ที่หยิบวันนี้ (ยังไม่โหลด)
  // ========================================
  const { data: faceSheetItems } = await supabase
    .from('face_sheet_items')
    .select(`
      id, sku_id, quantity_picked, status, picked_at,
      face_sheets!inner(id, face_sheet_no, status)
    `)
    .eq('status', 'picked')
    .gte('picked_at', today + 'T00:00:00')
    .lt('picked_at', today + 'T23:59:59');

  const pickedFsItems = (faceSheetItems || []).filter(item =>
    item.face_sheets?.status !== 'loaded' && item.face_sheets?.status !== 'delivered'
  );

  // ========================================
  // 4. คำนวณว่าแต่ละ SKU ควรมีเท่าไหร่ที่ Dispatch
  // ========================================
  const expectedBySku = {};

  pickedPicklistItems.forEach(item => {
    if (!expectedBySku[item.sku_id]) {
      expectedBySku[item.sku_id] = { picklist: 0, faceSheet: 0, total: 0 };
    }
    expectedBySku[item.sku_id].picklist += item.quantity_picked || 0;
    expectedBySku[item.sku_id].total += item.quantity_picked || 0;
  });

  pickedFsItems.forEach(item => {
    if (!expectedBySku[item.sku_id]) {
      expectedBySku[item.sku_id] = { picklist: 0, faceSheet: 0, total: 0 };
    }
    expectedBySku[item.sku_id].faceSheet += item.quantity_picked || 0;
    expectedBySku[item.sku_id].total += item.quantity_picked || 0;
  });

  // ========================================
  // 5. เปรียบเทียบกับ Dispatch Balance ปัจจุบัน
  // ========================================
  const actualBySku = {};
  dispatchBalances.forEach(b => {
    if (!actualBySku[b.sku_id]) {
      actualBySku[b.sku_id] = { qty: 0, records: [] };
    }
    actualBySku[b.sku_id].qty += b.total_piece_qty || 0;
    actualBySku[b.sku_id].records.push(b);
  });

  // ========================================
  // 6. หา SKU ที่ต้องแก้ไข
  // ========================================
  const toFix = [];
  const toDelete = [];
  const toCreate = [];

  // SKU ที่มีใน Dispatch แต่ไม่มีในงานหยิบวันนี้ = ลบออก
  Object.keys(actualBySku).forEach(sku => {
    if (!expectedBySku[sku]) {
      toDelete.push({
        sku,
        currentQty: actualBySku[sku].qty,
        records: actualBySku[sku].records
      });
    }
  });

  // SKU ที่มีในงานหยิบแต่ไม่มีใน Dispatch = สร้างใหม่
  Object.keys(expectedBySku).forEach(sku => {
    if (!actualBySku[sku]) {
      toCreate.push({
        sku,
        expectedQty: expectedBySku[sku].total
      });
    }
  });

  // SKU ที่มีทั้งสองฝั่งแต่จำนวนไม่ตรง = แก้ไข
  Object.keys(expectedBySku).forEach(sku => {
    if (actualBySku[sku]) {
      const expected = expectedBySku[sku].total;
      const actual = actualBySku[sku].qty;
      if (expected !== actual) {
        toFix.push({
          sku,
          expected,
          actual,
          diff: expected - actual,
          records: actualBySku[sku].records
        });
      }
    }
  });

  // ========================================
  // 7. แสดงผลการวิเคราะห์
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📊 ผลการวิเคราะห์:');
  console.log(`   - ลบออก (ไม่มีงานหยิบวันนี้): ${toDelete.length} SKUs`);
  console.log(`   - สร้างใหม่ (มีงานหยิบแต่ไม่มี balance): ${toCreate.length} SKUs`);
  console.log(`   - แก้ไขจำนวน: ${toFix.length} SKUs`);

  if (toDelete.length > 0) {
    console.log('\n🗑️  SKU ที่จะลบออก:');
    toDelete.forEach(d => {
      console.log(`   - ${d.sku}: ${d.currentQty} ชิ้น (${d.records.length} records)`);
    });
  }

  if (toCreate.length > 0) {
    console.log('\n➕ SKU ที่จะสร้างใหม่:');
    toCreate.forEach(c => {
      console.log(`   - ${c.sku}: ${c.expectedQty} ชิ้น`);
    });
  }

  if (toFix.length > 0) {
    console.log('\n🔧 SKU ที่จะแก้ไขจำนวน:');
    toFix.forEach(f => {
      const sign = f.diff > 0 ? '+' : '';
      console.log(`   - ${f.sku}: ${f.actual} → ${f.expected} (${sign}${f.diff})`);
    });
  }

  // ========================================
  // 8. ยืนยันก่อนแก้ไข
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('⚠️  ต้องการดำเนินการแก้ไขหรือไม่?');
  console.log('   รัน: node fix-dispatch-balance.js --apply');
  console.log('='.repeat(100));

  // ตรวจสอบว่ามี --apply flag หรือไม่
  if (process.argv.includes('--apply')) {
    console.log('\n🚀 กำลังดำเนินการแก้ไข...\n');

    let deletedCount = 0;
    let updatedCount = 0;

    // ลบ records ที่ไม่มีงานหยิบวันนี้
    for (const d of toDelete) {
      for (const record of d.records) {
        const { error } = await supabase
          .from('wms_inventory_balances')
          .delete()
          .eq('balance_id', record.balance_id);

        if (error) {
          console.log(`❌ Error deleting ${d.sku}: ${error.message}`);
        } else {
          deletedCount++;
          console.log(`✅ ลบ ${d.sku} (balance_id: ${record.balance_id})`);
        }
      }
    }

    // แก้ไขจำนวนที่ไม่ตรง
    for (const f of toFix) {
      // ใช้ record แรกเป็นตัวหลัก และ update จำนวน
      if (f.records.length > 0) {
        const mainRecord = f.records[0];

        // ลบ records อื่นๆ ก่อน (ถ้ามีหลาย records)
        for (let i = 1; i < f.records.length; i++) {
          await supabase
            .from('wms_inventory_balances')
            .delete()
            .eq('balance_id', f.records[i].balance_id);
          deletedCount++;
        }

        // Update record หลัก
        const { error } = await supabase
          .from('wms_inventory_balances')
          .update({ total_piece_qty: f.expected })
          .eq('balance_id', mainRecord.balance_id);

        if (error) {
          console.log(`❌ Error updating ${f.sku}: ${error.message}`);
        } else {
          updatedCount++;
          console.log(`✅ แก้ไข ${f.sku}: ${f.actual} → ${f.expected}`);
        }
      }
    }

    // สร้าง records ใหม่สำหรับ SKU ที่ไม่มี
    for (const c of toCreate) {
      const { error } = await supabase
        .from('wms_inventory_balances')
        .insert({
          warehouse_id: 'WH001',
          location_id: 'Dispatch',
          sku_id: c.sku,
          total_piece_qty: c.expectedQty,
          total_pack_qty: 0,
          reserved_piece_qty: 0,
          reserved_pack_qty: 0
        });

      if (error) {
        console.log(`❌ Error creating ${c.sku}: ${error.message}`);
      } else {
        updatedCount++;
        console.log(`✅ สร้าง ${c.sku}: ${c.expectedQty} ชิ้น`);
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log(`📊 สรุปการแก้ไข:`);
    console.log(`   - ลบ: ${deletedCount} records`);
    console.log(`   - แก้ไข/สร้าง: ${updatedCount} records`);
    console.log('='.repeat(100));
  }
}

analyzeAndFix().catch(console.error);
