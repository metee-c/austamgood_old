// ตรวจสอบสินค้าที่ MRTD และ PQTD ว่าตรงกับ BFS ที่ย้ายไปรอโหลดวันนี้หรือไม่
// BFS workflow: หยิบ → PR01-10/MR01-10 → สร้างใบโหลด → กดย้ายไป MRTD/PQTD
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMRTDandPQTDwithBFS() {
  const today = new Date().toISOString().split('T')[0];
  console.log('📊 ตรวจสอบสินค้าที่ MRTD และ PQTD vs BFS ที่ย้ายไปรอโหลดวันนี้');
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
  // 2. ดึงรายการ inventory ledger ที่ย้ายเข้า MRTD/PQTD วันนี้
  // ========================================
  const { data: ledgerIn, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('sku_id, location_id, qty_in, reference_doc_type, reference_doc_no, created_at')
    .in('location_id', ['MRTD', 'PQTD'])
    .gt('qty_in', 0)
    .gte('created_at', today + 'T00:00:00')
    .lt('created_at', today + 'T23:59:59');

  if (ledgerError) {
    console.log('❌ Error loading ledger:', ledgerError.message);
    return;
  }

  // รวมตาม SKU และ location
  const ledgerToMRTD = {};
  const ledgerToPQTD = {};

  (ledgerIn || []).forEach(entry => {
    if (entry.location_id === 'MRTD') {
      if (!ledgerToMRTD[entry.sku_id]) ledgerToMRTD[entry.sku_id] = 0;
      ledgerToMRTD[entry.sku_id] += entry.qty_in || 0;
    } else if (entry.location_id === 'PQTD') {
      if (!ledgerToPQTD[entry.sku_id]) ledgerToPQTD[entry.sku_id] = 0;
      ledgerToPQTD[entry.sku_id] += entry.qty_in || 0;
    }
  });

  console.log(`\n📥 Ledger IN เข้า MRTD วันนี้: ${Object.keys(ledgerToMRTD).length} SKUs`);
  console.log(`📥 Ledger IN เข้า PQTD วันนี้: ${Object.keys(ledgerToPQTD).length} SKUs`);

  // ========================================
  // 3. ดึงรายการ inventory ledger ที่ย้ายออกจาก MRTD/PQTD วันนี้
  // ========================================
  const { data: ledgerOut, error: ledgerOutError } = await supabase
    .from('wms_inventory_ledger')
    .select('sku_id, location_id, qty_out, reference_doc_type, reference_doc_no, created_at')
    .in('location_id', ['MRTD', 'PQTD'])
    .gt('qty_out', 0)
    .gte('created_at', today + 'T00:00:00')
    .lt('created_at', today + 'T23:59:59');

  if (ledgerOutError) {
    console.log('❌ Error loading ledger out:', ledgerOutError.message);
    return;
  }

  // รวมตาม SKU และ location
  const ledgerFromMRTD = {};
  const ledgerFromPQTD = {};

  (ledgerOut || []).forEach(entry => {
    if (entry.location_id === 'MRTD') {
      if (!ledgerFromMRTD[entry.sku_id]) ledgerFromMRTD[entry.sku_id] = 0;
      ledgerFromMRTD[entry.sku_id] += entry.qty_out || 0;
    } else if (entry.location_id === 'PQTD') {
      if (!ledgerFromPQTD[entry.sku_id]) ledgerFromPQTD[entry.sku_id] = 0;
      ledgerFromPQTD[entry.sku_id] += entry.qty_out || 0;
    }
  });

  console.log(`\n📤 Ledger OUT จาก MRTD วันนี้: ${Object.keys(ledgerFromMRTD).length} SKUs`);
  console.log(`📤 Ledger OUT จาก PQTD วันนี้: ${Object.keys(ledgerFromPQTD).length} SKUs`);

  // ========================================
  // 4. เปรียบเทียบ MRTD
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📊 เปรียบเทียบ MRTD: Balance vs (Ledger IN - Ledger OUT) วันนี้');
  console.log('-'.repeat(100));

  const allMRTDSkus = new Set([
    ...Object.keys(mrtdBySku),
    ...Object.keys(ledgerToMRTD),
    ...Object.keys(ledgerFromMRTD)
  ]);

  let mrtdMatchCount = 0;
  let mrtdMismatchCount = 0;

  if (allMRTDSkus.size > 0) {
    console.log(
      'SKU'.padEnd(30) +
      'Balance'.padEnd(12) +
      'Ledger IN'.padEnd(12) +
      'Ledger OUT'.padEnd(12) +
      'Net Today'.padEnd(14) +
      'Match?'
    );
    console.log('-'.repeat(100));

    Array.from(allMRTDSkus).sort().forEach(sku => {
      const balance = mrtdBySku[sku]?.total_piece_qty || 0;
      const ledgerIn = ledgerToMRTD[sku] || 0;
      const ledgerOut = ledgerFromMRTD[sku] || 0;
      const netToday = ledgerIn - ledgerOut;
      // Balance ควรเท่ากับ Net Today (ถ้าเริ่มต้นวันนี้ที่ 0)
      const isMatch = balance === netToday;

      if (isMatch) mrtdMatchCount++;
      else mrtdMismatchCount++;

      if (!isMatch || balance > 0 || netToday !== 0) {
        console.log(
          sku.substring(0, 28).padEnd(30) +
          String(balance).padEnd(12) +
          String(ledgerIn).padEnd(12) +
          String(ledgerOut).padEnd(12) +
          String(netToday).padEnd(14) +
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
  console.log('📊 เปรียบเทียบ PQTD: Balance vs (Ledger IN - Ledger OUT) วันนี้');
  console.log('-'.repeat(100));

  const allPQTDSkus = new Set([
    ...Object.keys(pqtdBySku),
    ...Object.keys(ledgerToPQTD),
    ...Object.keys(ledgerFromPQTD)
  ]);

  let pqtdMatchCount = 0;
  let pqtdMismatchCount = 0;

  if (allPQTDSkus.size > 0) {
    console.log(
      'SKU'.padEnd(30) +
      'Balance'.padEnd(12) +
      'Ledger IN'.padEnd(12) +
      'Ledger OUT'.padEnd(12) +
      'Net Today'.padEnd(14) +
      'Match?'
    );
    console.log('-'.repeat(100));

    Array.from(allPQTDSkus).sort().forEach(sku => {
      const balance = pqtdBySku[sku]?.total_piece_qty || 0;
      const ledgerIn = ledgerToPQTD[sku] || 0;
      const ledgerOut = ledgerFromPQTD[sku] || 0;
      const netToday = ledgerIn - ledgerOut;
      const isMatch = balance === netToday;

      if (isMatch) pqtdMatchCount++;
      else pqtdMismatchCount++;

      if (!isMatch || balance > 0 || netToday !== 0) {
        console.log(
          sku.substring(0, 28).padEnd(30) +
          String(balance).padEnd(12) +
          String(ledgerIn).padEnd(12) +
          String(ledgerOut).padEnd(12) +
          String(netToday).padEnd(14) +
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
  // 6. แสดงรายละเอียด Ledger Entries
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📋 รายละเอียด Ledger Entries วันนี้ (MRTD & PQTD):');
  console.log('-'.repeat(100));

  const allLedgerEntries = [...(ledgerIn || []), ...(ledgerOut || [])];
  if (allLedgerEntries.length > 0) {
    console.log(
      'Location'.padEnd(10) +
      'SKU'.padEnd(25) +
      'IN'.padEnd(10) +
      'OUT'.padEnd(10) +
      'Doc Type'.padEnd(15) +
      'Doc No'
    );
    console.log('-'.repeat(100));

    allLedgerEntries.slice(0, 50).forEach(entry => {
      console.log(
        String(entry.location_id).padEnd(10) +
        String(entry.sku_id).substring(0, 23).padEnd(25) +
        String(entry.qty_in || 0).padEnd(10) +
        String(entry.qty_out || 0).padEnd(10) +
        String(entry.reference_doc_type || '-').padEnd(15) +
        String(entry.reference_doc_no || '-')
      );
    });

    if (allLedgerEntries.length > 50) {
      console.log(`... และอีก ${allLedgerEntries.length - 50} รายการ`);
    }
  } else {
    console.log('ไม่มี Ledger entries วันนี้');
  }

  // ========================================
  // 7. สรุป
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📊 สรุป:');
  console.log(`   MRTD: ${mrtdMatchCount}/${allMRTDSkus.size} SKUs ตรงกัน ${mrtdMismatchCount === 0 ? '✅' : '❌'}`);
  console.log(`   PQTD: ${pqtdMatchCount}/${allPQTDSkus.size} SKUs ตรงกัน ${pqtdMismatchCount === 0 ? '✅' : '❌'}`);
  console.log('='.repeat(100));
}

checkMRTDandPQTDwithBFS().catch(console.error);
