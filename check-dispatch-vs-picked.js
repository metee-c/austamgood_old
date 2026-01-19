// ตรวจสอบสินค้าที่ Dispatch ว่าตรงกับงานที่ยืนยันหยิบแล้วแต่ยังไม่ได้โหลด
// เฉพาะ Picklist และ Face Sheet ที่ยืนยันหยิบวันนี้เท่านั้น
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDispatchVsPicked() {
  const today = new Date().toISOString().split('T')[0];
  console.log('📊 ตรวจสอบสินค้าที่ Dispatch vs งานที่ยืนยันหยิบวันนี้');
  console.log(`📅 วันที่: ${today}`);
  console.log('='.repeat(100));

  // ========================================
  // 1. ดึงสินค้าที่อยู่ใน Dispatch จาก inventory_balances
  // ========================================
  const { data: dispatchBalances, error: dispatchError } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, total_piece_qty, reserved_piece_qty, location_id')
    .eq('location_id', 'Dispatch')
    .gt('total_piece_qty', 0);

  if (dispatchError) {
    console.log('❌ Error loading dispatch balances:', dispatchError.message);
    return;
  }

  // รวมตาม SKU
  const dispatchBySku = {};
  (dispatchBalances || []).forEach(b => {
    if (!dispatchBySku[b.sku_id]) {
      dispatchBySku[b.sku_id] = { total_piece_qty: 0, reserved_piece_qty: 0 };
    }
    dispatchBySku[b.sku_id].total_piece_qty += b.total_piece_qty || 0;
    dispatchBySku[b.sku_id].reserved_piece_qty += b.reserved_piece_qty || 0;
  });

  console.log(`\n📦 สินค้าที่ Dispatch: ${Object.keys(dispatchBySku).length} SKUs`);

  // ========================================
  // 2. ดึง Picklist items ที่ยืนยันหยิบวันนี้ แต่ยังไม่ได้โหลด
  // ========================================
  const { data: picklistItems, error: picklistError } = await supabase
    .from('picklist_items')
    .select(`
      id,
      sku_id,
      quantity_picked,
      status,
      picked_at,
      picklists!inner(id, picklist_code, status)
    `)
    .eq('status', 'picked')
    .gte('picked_at', today + 'T00:00:00')
    .lt('picked_at', today + 'T23:59:59');

  if (picklistError) {
    console.log('❌ Error loading picklist items:', picklistError.message);
    return;
  }

  // Filter เฉพาะ picklist ที่ยังไม่ได้โหลด (status = 'completed' แต่ loadlist ยังไม่ loaded)
  const pickedPicklistItems = (picklistItems || []).filter(item =>
    item.picklists?.status === 'completed'
  );

  // รวมตาม SKU
  const picklistBySku = {};
  pickedPicklistItems.forEach(item => {
    if (!picklistBySku[item.sku_id]) {
      picklistBySku[item.sku_id] = { qty: 0, items: [] };
    }
    picklistBySku[item.sku_id].qty += item.quantity_picked || 0;
    picklistBySku[item.sku_id].items.push({
      picklist_code: item.picklists?.picklist_code,
      qty: item.quantity_picked
    });
  });

  console.log(`\n📋 Picklist items ที่หยิบวันนี้: ${pickedPicklistItems.length} items`);

  // ========================================
  // 3. ดึง Face Sheet items ที่ยืนยันหยิบวันนี้ แต่ยังไม่ได้โหลด
  // ========================================
  const { data: faceSheetItems, error: fsError } = await supabase
    .from('face_sheet_items')
    .select(`
      id,
      sku_id,
      quantity_picked,
      status,
      picked_at,
      face_sheets!inner(id, face_sheet_no, status)
    `)
    .eq('status', 'picked')
    .gte('picked_at', today + 'T00:00:00')
    .lt('picked_at', today + 'T23:59:59');

  if (fsError) {
    console.log('❌ Error loading face sheet items:', fsError.message);
    return;
  }

  // Filter เฉพาะ face sheet ที่ยังไม่ได้โหลด (status != 'loaded')
  const pickedFsItems = (faceSheetItems || []).filter(item =>
    item.face_sheets?.status !== 'loaded' && item.face_sheets?.status !== 'delivered'
  );

  // รวมตาม SKU
  const fsBySku = {};
  pickedFsItems.forEach(item => {
    if (!fsBySku[item.sku_id]) {
      fsBySku[item.sku_id] = { qty: 0, items: [] };
    }
    fsBySku[item.sku_id].qty += item.quantity_picked || 0;
    fsBySku[item.sku_id].items.push({
      face_sheet_no: item.face_sheets?.face_sheet_no,
      qty: item.quantity_picked
    });
  });

  console.log(`\n📄 Face Sheet items ที่หยิบวันนี้: ${pickedFsItems.length} items`);

  // ========================================
  // 4. เปรียบเทียบ
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📊 เปรียบเทียบ: Dispatch Balance vs งานที่หยิบวันนี้');
  console.log('-'.repeat(100));
  console.log(
    'SKU'.padEnd(30) +
    'Dispatch'.padEnd(12) +
    'Picklist'.padEnd(12) +
    'FaceSheet'.padEnd(12) +
    'Total Picked'.padEnd(14) +
    'Match?'
  );
  console.log('-'.repeat(100));

  // รวม SKU ทั้งหมด
  const allSkus = new Set([
    ...Object.keys(dispatchBySku),
    ...Object.keys(picklistBySku),
    ...Object.keys(fsBySku)
  ]);

  let matchCount = 0;
  let mismatchCount = 0;
  const mismatches = [];

  Array.from(allSkus).sort().forEach(sku => {
    const dispatch = dispatchBySku[sku]?.total_piece_qty || 0;
    const picklist = picklistBySku[sku]?.qty || 0;
    const faceSheet = fsBySku[sku]?.qty || 0;
    const totalPicked = picklist + faceSheet;

    const isMatch = dispatch === totalPicked;
    const matchStr = isMatch ? '✅' : '❌';

    if (isMatch) {
      matchCount++;
    } else {
      mismatchCount++;
      mismatches.push({
        sku,
        dispatch,
        picklist,
        faceSheet,
        totalPicked,
        diff: dispatch - totalPicked
      });
    }

    // แสดงเฉพาะที่ไม่ตรงหรือมีข้อมูล
    if (!isMatch || dispatch > 0 || totalPicked > 0) {
      console.log(
        sku.substring(0, 28).padEnd(30) +
        String(dispatch).padEnd(12) +
        String(picklist).padEnd(12) +
        String(faceSheet).padEnd(12) +
        String(totalPicked).padEnd(14) +
        matchStr
      );
    }
  });

  console.log('-'.repeat(100));
  console.log(`✅ ตรงกัน: ${matchCount} SKUs`);
  console.log(`❌ ไม่ตรง: ${mismatchCount} SKUs`);

  // ========================================
  // 5. แสดงรายละเอียดที่ไม่ตรง
  // ========================================
  if (mismatches.length > 0) {
    console.log('\n' + '='.repeat(100));
    console.log('⚠️  รายละเอียด SKU ที่ไม่ตรง:');
    console.log('-'.repeat(100));

    mismatches.forEach(m => {
      console.log(`\n📦 ${m.sku}`);
      console.log(`   Dispatch: ${m.dispatch}`);
      console.log(`   Picklist: ${m.picklist}`);
      console.log(`   FaceSheet: ${m.faceSheet}`);
      console.log(`   ส่วนต่าง: ${m.diff > 0 ? '+' : ''}${m.diff}`);

      if (m.diff > 0) {
        console.log(`   ⚠️  Dispatch มีมากกว่างานที่หยิบ ${m.diff} ชิ้น (อาจมีงานเก่าค้าง)`);
      } else {
        console.log(`   ⚠️  งานที่หยิบมากกว่า Dispatch ${Math.abs(m.diff)} ชิ้น (อาจมีปัญหา)`);
      }
    });
  }

  // ========================================
  // 6. สรุป
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📊 สรุป:');
  console.log(`   - สินค้าใน Dispatch: ${Object.keys(dispatchBySku).length} SKUs`);
  console.log(`   - Picklist items หยิบวันนี้: ${pickedPicklistItems.length} items`);
  console.log(`   - Face Sheet items หยิบวันนี้: ${pickedFsItems.length} items`);
  console.log(`   - ตรงกัน: ${matchCount} / ${allSkus.size} SKUs`);

  if (mismatchCount === 0) {
    console.log('\n✅ ผลลัพธ์: สินค้าที่ Dispatch ตรงกับงานที่หยิบวันนี้ทั้งหมด!');
  } else {
    console.log(`\n⚠️  ผลลัพธ์: มี ${mismatchCount} SKU ที่ไม่ตรง - กรุณาตรวจสอบ`);
  }
}

checkDispatchVsPicked().catch(console.error);
