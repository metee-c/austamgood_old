// วิเคราะห์ MRTD/PQTD Ledger entries อย่างละเอียด
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeMRTDLedger() {
  console.log('📊 วิเคราะห์ MRTD/PQTD Ledger Entries');
  console.log('='.repeat(120));

  // ========================================
  // 1. นับ IN vs OUT
  // ========================================
  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('sku_id, location_id, piece_qty, direction, reference_doc_type, reference_no, created_at')
    .in('location_id', ['MRTD', 'PQTD'])
    .order('created_at', { ascending: false });

  if (ledgerError) {
    console.log('❌ Error loading ledger:', ledgerError.message);
    return;
  }

  let inCount = 0;
  let outCount = 0;
  let inQty = 0;
  let outQty = 0;

  (ledgerEntries || []).forEach(entry => {
    if (entry.direction === 'in') {
      inCount++;
      inQty += parseFloat(entry.piece_qty) || 0;
    } else if (entry.direction === 'out') {
      outCount++;
      outQty += parseFloat(entry.piece_qty) || 0;
    }
  });

  console.log(`\n📊 สรุป Ledger Entries:`);
  console.log(`   Total entries: ${(ledgerEntries || []).length}`);
  console.log(`   IN entries: ${inCount} (total qty: ${inQty})`);
  console.log(`   OUT entries: ${outCount} (total qty: ${outQty})`);
  console.log(`   Net: ${inQty - outQty}`);

  // ========================================
  // 2. แสดง reference_doc_type breakdown
  // ========================================
  const docTypeBreakdown = {};
  (ledgerEntries || []).forEach(entry => {
    const key = `${entry.direction}|${entry.reference_doc_type || 'null'}`;
    if (!docTypeBreakdown[key]) {
      docTypeBreakdown[key] = { count: 0, qty: 0 };
    }
    docTypeBreakdown[key].count++;
    docTypeBreakdown[key].qty += parseFloat(entry.piece_qty) || 0;
  });

  console.log('\n📋 Breakdown by direction + doc_type:');
  console.log('-'.repeat(80));
  console.log(
    'Direction'.padEnd(10) +
    'Doc Type'.padEnd(40) +
    'Count'.padEnd(10) +
    'Total Qty'
  );
  console.log('-'.repeat(80));

  Object.keys(docTypeBreakdown).sort().forEach(key => {
    const [direction, docType] = key.split('|');
    const data = docTypeBreakdown[key];
    console.log(
      direction.padEnd(10) +
      docType.padEnd(40) +
      String(data.count).padEnd(10) +
      String(data.qty)
    );
  });

  // ========================================
  // 3. แสดง 50 entries ล่าสุด
  // ========================================
  console.log('\n' + '='.repeat(120));
  console.log('📝 50 Ledger Entries ล่าสุด:');
  console.log('-'.repeat(120));
  console.log(
    'Location'.padEnd(8) +
    'SKU'.padEnd(28) +
    'Dir'.padEnd(5) +
    'Qty'.padEnd(8) +
    'Doc Type'.padEnd(35) +
    'Ref No'.padEnd(30) +
    'Created'
  );
  console.log('-'.repeat(120));

  (ledgerEntries || []).slice(0, 50).forEach(entry => {
    console.log(
      String(entry.location_id).padEnd(8) +
      String(entry.sku_id).substring(0, 26).padEnd(28) +
      String(entry.direction).padEnd(5) +
      String(entry.piece_qty || 0).padEnd(8) +
      String(entry.reference_doc_type || '-').substring(0, 33).padEnd(35) +
      String(entry.reference_no || '-').substring(0, 28).padEnd(30) +
      String(entry.created_at?.substring(0, 19) || '-')
    );
  });

  // ========================================
  // 4. ดูว่ามี IN entries จาก BFS staging หรือเปล่า
  // ========================================
  console.log('\n' + '='.repeat(120));
  console.log('🔍 ค้นหา IN entries จาก bonus_face_sheet_staging:');
  console.log('-'.repeat(120));

  const bfsInEntries = (ledgerEntries || []).filter(e =>
    e.direction === 'in' &&
    e.reference_doc_type &&
    e.reference_doc_type.includes('bonus_face_sheet')
  );

  if (bfsInEntries.length > 0) {
    console.log(`พบ ${bfsInEntries.length} entries:`);
    bfsInEntries.slice(0, 20).forEach(entry => {
      console.log(
        String(entry.location_id).padEnd(8) +
        String(entry.sku_id).substring(0, 26).padEnd(28) +
        String(entry.piece_qty).padEnd(8) +
        String(entry.reference_doc_type || '-').substring(0, 33).padEnd(35) +
        String(entry.reference_no || '-')
      );
    });
  } else {
    console.log('ไม่พบ IN entries จาก bonus_face_sheet');
  }

  // ========================================
  // 5. ตรวจสอบว่า balance = 0 แต่ ledger net > 0 มีกี่ SKU
  // ========================================
  console.log('\n' + '='.repeat(120));
  console.log('📊 SKUs ที่ Ledger Net > 0 (ควรมี balance):');
  console.log('-'.repeat(80));

  const skuNet = {};
  (ledgerEntries || []).forEach(entry => {
    const key = `${entry.location_id}|${entry.sku_id}`;
    if (!skuNet[key]) {
      skuNet[key] = { location_id: entry.location_id, sku_id: entry.sku_id, net: 0 };
    }
    if (entry.direction === 'in') {
      skuNet[key].net += parseFloat(entry.piece_qty) || 0;
    } else if (entry.direction === 'out') {
      skuNet[key].net -= parseFloat(entry.piece_qty) || 0;
    }
  });

  const positiveNet = Object.values(skuNet).filter(s => s.net > 0);
  const negativeNet = Object.values(skuNet).filter(s => s.net < 0);
  const zeroNet = Object.values(skuNet).filter(s => s.net === 0);

  console.log(`SKUs with positive net (ควรมี balance > 0): ${positiveNet.length}`);
  console.log(`SKUs with negative net (ปัญหา! ออกมากกว่าเข้า): ${negativeNet.length}`);
  console.log(`SKUs with zero net: ${zeroNet.length}`);

  if (positiveNet.length > 0) {
    console.log('\n✅ SKUs ที่ควรมี balance (net > 0):');
    positiveNet.forEach(s => {
      console.log(`   ${s.location_id}/${s.sku_id}: ${s.net}`);
    });
  }

  if (negativeNet.length > 0 && negativeNet.length < 20) {
    console.log('\n❌ SKUs ที่มีปัญหา (net < 0 = ออกมากกว่าเข้า):');
    negativeNet.forEach(s => {
      console.log(`   ${s.location_id}/${s.sku_id}: ${s.net}`);
    });
  }

  console.log('\n' + '='.repeat(120));
}

analyzeMRTDLedger().catch(console.error);
