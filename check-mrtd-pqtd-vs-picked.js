// ตรวจสอบสินค้าที่ MRTD และ PQTD ว่าตรงกับงานที่ยืนยันหยิบวันนี้หรือไม่
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMRTDandPQTD() {
  const today = new Date().toISOString().split('T')[0];
  console.log('📊 ตรวจสอบสินค้าที่ MRTD และ PQTD vs งานที่ยืนยันหยิบวันนี้');
  console.log(`📅 วันที่: ${today}`);
  console.log('='.repeat(100));

  // ========================================
  // 1. ดึงสินค้าที่อยู่ใน MRTD และ PQTD
  // ========================================
  const { data: balances, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, total_piece_qty, reserved_piece_qty, location_id')
    .in('location_id', ['MRTD', 'PQTD'])
    .gt('total_piece_qty', 0);

  if (balanceError) {
    console.log('❌ Error loading balances:', balanceError.message);
    return;
  }

  // แยกตาม location
  const mrtdBySku = {};
  const pqtdBySku = {};

  (balances || []).forEach(b => {
    if (b.location_id === 'MRTD') {
      if (!mrtdBySku[b.sku_id]) {
        mrtdBySku[b.sku_id] = { total_piece_qty: 0, reserved_piece_qty: 0 };
      }
      mrtdBySku[b.sku_id].total_piece_qty += b.total_piece_qty || 0;
      mrtdBySku[b.sku_id].reserved_piece_qty += b.reserved_piece_qty || 0;
    } else if (b.location_id === 'PQTD') {
      if (!pqtdBySku[b.sku_id]) {
        pqtdBySku[b.sku_id] = { total_piece_qty: 0, reserved_piece_qty: 0 };
      }
      pqtdBySku[b.sku_id].total_piece_qty += b.total_piece_qty || 0;
      pqtdBySku[b.sku_id].reserved_piece_qty += b.reserved_piece_qty || 0;
    }
  });

  console.log(`\n📦 MRTD: ${Object.keys(mrtdBySku).length} SKUs`);
  console.log(`📦 PQTD: ${Object.keys(pqtdBySku).length} SKUs`);

  // ========================================
  // 2. ดึง Picklist items ที่หยิบวันนี้ โดยดูจาก source_location_id
  // ========================================
  const { data: picklistItems, error: picklistError } = await supabase
    .from('picklist_items')
    .select(`
      id, sku_id, quantity_picked, status, picked_at, source_location_id,
      picklists!inner(id, picklist_code, status)
    `)
    .eq('status', 'picked')
    .gte('picked_at', today + 'T00:00:00')
    .lt('picked_at', today + 'T23:59:59');

  if (picklistError) {
    console.log('❌ Error loading picklist items:', picklistError.message);
    return;
  }

  // Filter เฉพาะ picklist ที่ completed
  const pickedPicklistItems = (picklistItems || []).filter(item =>
    item.picklists?.status === 'completed'
  );

  // แยกตาม source_location_id
  const picklistFromMRTD = {};
  const picklistFromPQTD = {};

  pickedPicklistItems.forEach(item => {
    const loc = item.source_location_id;
    if (loc === 'MRTD') {
      if (!picklistFromMRTD[item.sku_id]) picklistFromMRTD[item.sku_id] = 0;
      picklistFromMRTD[item.sku_id] += item.quantity_picked || 0;
    } else if (loc === 'PQTD') {
      if (!picklistFromPQTD[item.sku_id]) picklistFromPQTD[item.sku_id] = 0;
      picklistFromPQTD[item.sku_id] += item.quantity_picked || 0;
    }
  });

  console.log(`\n📋 Picklist items หยิบจาก MRTD วันนี้: ${Object.keys(picklistFromMRTD).length} SKUs`);
  console.log(`📋 Picklist items หยิบจาก PQTD วันนี้: ${Object.keys(picklistFromPQTD).length} SKUs`);

  // ========================================
  // 3. ดึง Face Sheet items ที่หยิบวันนี้ โดยดูจาก source_location_id
  // ========================================
  const { data: faceSheetItems, error: fsError } = await supabase
    .from('face_sheet_items')
    .select(`
      id, sku_id, quantity_picked, status, picked_at, source_location_id,
      face_sheets!inner(id, face_sheet_no, status)
    `)
    .eq('status', 'picked')
    .gte('picked_at', today + 'T00:00:00')
    .lt('picked_at', today + 'T23:59:59');

  if (fsError) {
    console.log('❌ Error loading face sheet items:', fsError.message);
    return;
  }

  // Filter เฉพาะ face sheet ที่ยังไม่ได้โหลด
  const pickedFsItems = (faceSheetItems || []).filter(item =>
    item.face_sheets?.status !== 'loaded' && item.face_sheets?.status !== 'delivered'
  );

  // แยกตาม source_location_id
  const fsFromMRTD = {};
  const fsFromPQTD = {};

  pickedFsItems.forEach(item => {
    const loc = item.source_location_id;
    if (loc === 'MRTD') {
      if (!fsFromMRTD[item.sku_id]) fsFromMRTD[item.sku_id] = 0;
      fsFromMRTD[item.sku_id] += item.quantity_picked || 0;
    } else if (loc === 'PQTD') {
      if (!fsFromPQTD[item.sku_id]) fsFromPQTD[item.sku_id] = 0;
      fsFromPQTD[item.sku_id] += item.quantity_picked || 0;
    }
  });

  console.log(`\n📄 Face Sheet items หยิบจาก MRTD วันนี้: ${Object.keys(fsFromMRTD).length} SKUs`);
  console.log(`📄 Face Sheet items หยิบจาก PQTD วันนี้: ${Object.keys(fsFromPQTD).length} SKUs`);

  // ========================================
  // 4. เปรียบเทียบ MRTD
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📊 เปรียบเทียบ MRTD Balance vs งานที่หยิบวันนี้');
  console.log('-'.repeat(100));

  const allMRTDSkus = new Set([
    ...Object.keys(mrtdBySku),
    ...Object.keys(picklistFromMRTD),
    ...Object.keys(fsFromMRTD)
  ]);

  let mrtdMatchCount = 0;
  let mrtdMismatchCount = 0;

  if (allMRTDSkus.size > 0) {
    console.log(
      'SKU'.padEnd(30) +
      'Balance'.padEnd(12) +
      'Picklist'.padEnd(12) +
      'FaceSheet'.padEnd(12) +
      'Total Picked'.padEnd(14) +
      'Match?'
    );
    console.log('-'.repeat(100));

    Array.from(allMRTDSkus).sort().forEach(sku => {
      const balance = mrtdBySku[sku]?.total_piece_qty || 0;
      const picklist = picklistFromMRTD[sku] || 0;
      const faceSheet = fsFromMRTD[sku] || 0;
      const totalPicked = picklist + faceSheet;
      const isMatch = balance === totalPicked;

      if (isMatch) mrtdMatchCount++;
      else mrtdMismatchCount++;

      if (!isMatch || balance > 0 || totalPicked > 0) {
        console.log(
          sku.substring(0, 28).padEnd(30) +
          String(balance).padEnd(12) +
          String(picklist).padEnd(12) +
          String(faceSheet).padEnd(12) +
          String(totalPicked).padEnd(14) +
          (isMatch ? '✅' : '❌')
        );
      }
    });

    console.log('-'.repeat(100));
    console.log(`MRTD: ✅ ตรงกัน: ${mrtdMatchCount} SKUs, ❌ ไม่ตรง: ${mrtdMismatchCount} SKUs`);
  } else {
    console.log('ไม่มีข้อมูลใน MRTD');
  }

  // ========================================
  // 5. เปรียบเทียบ PQTD
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📊 เปรียบเทียบ PQTD Balance vs งานที่หยิบวันนี้');
  console.log('-'.repeat(100));

  const allPQTDSkus = new Set([
    ...Object.keys(pqtdBySku),
    ...Object.keys(picklistFromPQTD),
    ...Object.keys(fsFromPQTD)
  ]);

  let pqtdMatchCount = 0;
  let pqtdMismatchCount = 0;

  if (allPQTDSkus.size > 0) {
    console.log(
      'SKU'.padEnd(30) +
      'Balance'.padEnd(12) +
      'Picklist'.padEnd(12) +
      'FaceSheet'.padEnd(12) +
      'Total Picked'.padEnd(14) +
      'Match?'
    );
    console.log('-'.repeat(100));

    Array.from(allPQTDSkus).sort().forEach(sku => {
      const balance = pqtdBySku[sku]?.total_piece_qty || 0;
      const picklist = picklistFromPQTD[sku] || 0;
      const faceSheet = fsFromPQTD[sku] || 0;
      const totalPicked = picklist + faceSheet;
      const isMatch = balance === totalPicked;

      if (isMatch) pqtdMatchCount++;
      else pqtdMismatchCount++;

      if (!isMatch || balance > 0 || totalPicked > 0) {
        console.log(
          sku.substring(0, 28).padEnd(30) +
          String(balance).padEnd(12) +
          String(picklist).padEnd(12) +
          String(faceSheet).padEnd(12) +
          String(totalPicked).padEnd(14) +
          (isMatch ? '✅' : '❌')
        );
      }
    });

    console.log('-'.repeat(100));
    console.log(`PQTD: ✅ ตรงกัน: ${pqtdMatchCount} SKUs, ❌ ไม่ตรง: ${pqtdMismatchCount} SKUs`);
  } else {
    console.log('ไม่มีข้อมูลใน PQTD');
  }

  // ========================================
  // 6. สรุป
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📊 สรุป:');
  console.log(`   MRTD: ${mrtdMatchCount}/${allMRTDSkus.size} SKUs ตรงกัน ${mrtdMismatchCount === 0 ? '✅' : '❌'}`);
  console.log(`   PQTD: ${pqtdMatchCount}/${allPQTDSkus.size} SKUs ตรงกัน ${pqtdMismatchCount === 0 ? '✅' : '❌'}`);
  console.log('='.repeat(100));
}

checkMRTDandPQTD().catch(console.error);
