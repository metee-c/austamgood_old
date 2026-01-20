// ตรวจสอบ MRTD/PQTD balance ที่แท้จริง (เฉพาะที่ > 0)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkActualBalance() {
  console.log('📊 ตรวจสอบ MRTD/PQTD Balance ที่แท้จริง');
  console.log('='.repeat(100));

  // ดึง balance ที่ > 0
  const { data: balances, error } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, location_id, total_piece_qty, reserved_piece_qty')
    .in('location_id', ['MRTD', 'PQTD'])
    .gt('total_piece_qty', 0)
    .order('location_id')
    .order('sku_id');

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  if (!balances || balances.length === 0) {
    console.log('\n✅ ไม่มี balance > 0 ที่ MRTD/PQTD');
    console.log('   (หมายความว่า Balance = 0 ตรงกับที่หน้า web แสดง)');
  } else {
    console.log(`\n📦 พบ ${balances.length} SKUs ที่มี balance > 0:`);
    console.log('-'.repeat(80));
    console.log(
      'Location'.padEnd(10) +
      'SKU'.padEnd(30) +
      'Total Qty'.padEnd(12) +
      'Reserved'
    );
    console.log('-'.repeat(80));

    balances.forEach(b => {
      console.log(
        String(b.location_id).padEnd(10) +
        String(b.sku_id).padEnd(30) +
        String(b.total_piece_qty).padEnd(12) +
        String(b.reserved_piece_qty || 0)
      );
    });
  }

  // ดึง balance ทั้งหมด (รวมที่ = 0)
  const { data: allBalances, error: allError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, location_id, total_piece_qty')
    .in('location_id', ['MRTD', 'PQTD']);

  if (!allError && allBalances) {
    const totalRecords = allBalances.length;
    const zeroRecords = allBalances.filter(b => (parseFloat(b.total_piece_qty) || 0) === 0).length;
    const positiveRecords = allBalances.filter(b => (parseFloat(b.total_piece_qty) || 0) > 0).length;
    const negativeRecords = allBalances.filter(b => (parseFloat(b.total_piece_qty) || 0) < 0).length;

    console.log('\n' + '='.repeat(100));
    console.log('📊 สรุป Balance Records ที่ MRTD/PQTD:');
    console.log(`   Total records: ${totalRecords}`);
    console.log(`   Records = 0: ${zeroRecords}`);
    console.log(`   Records > 0: ${positiveRecords}`);
    console.log(`   Records < 0: ${negativeRecords} ${negativeRecords > 0 ? '⚠️ ผิดปกติ!' : ''}`);

    if (negativeRecords > 0) {
      console.log('\n⚠️ พบ balance ติดลบ:');
      const negatives = allBalances.filter(b => (parseFloat(b.total_piece_qty) || 0) < 0);
      negatives.forEach(b => {
        console.log(`   ${b.location_id}/${b.sku_id}: ${b.total_piece_qty}`);
      });
    }
  }

  // คำนวณ ledger-based expected balance สำหรับ MRTD/PQTD เฉพาะวันนี้ (2026-01-19 และ 2026-01-20)
  console.log('\n' + '='.repeat(100));
  console.log('📋 ดูว่างานที่ย้ายไป MRTD/PQTD วันนี้ (19-20 ม.ค.) มีอะไรบ้าง:');

  const { data: recentLedger, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('sku_id, location_id, piece_qty, direction, reference_doc_type, reference_no, created_at')
    .in('location_id', ['MRTD', 'PQTD'])
    .gte('created_at', '2026-01-19T00:00:00')
    .order('created_at', { ascending: false });

  if (ledgerError) {
    console.log('❌ Error:', ledgerError.message);
    return;
  }

  // สรุปตาม SKU
  const skuSummary = {};
  (recentLedger || []).forEach(entry => {
    const key = `${entry.location_id}|${entry.sku_id}`;
    if (!skuSummary[key]) {
      skuSummary[key] = { location_id: entry.location_id, sku_id: entry.sku_id, in: 0, out: 0 };
    }
    if (entry.direction === 'in') {
      skuSummary[key].in += parseFloat(entry.piece_qty) || 0;
    } else if (entry.direction === 'out') {
      skuSummary[key].out += parseFloat(entry.piece_qty) || 0;
    }
  });

  const summaryArray = Object.values(skuSummary);
  const withActivity = summaryArray.filter(s => s.in > 0 || s.out > 0);

  console.log(`\n📦 พบ ${withActivity.length} SKUs ที่มี activity 19-20 ม.ค.:`);
  console.log('-'.repeat(90));
  console.log(
    'Location'.padEnd(10) +
    'SKU'.padEnd(30) +
    'IN'.padEnd(12) +
    'OUT'.padEnd(12) +
    'Net'.padEnd(12) +
    'Status'
  );
  console.log('-'.repeat(90));

  withActivity.forEach(s => {
    const net = s.in - s.out;
    console.log(
      String(s.location_id).padEnd(10) +
      String(s.sku_id).substring(0, 28).padEnd(30) +
      String(s.in).padEnd(12) +
      String(s.out).padEnd(12) +
      String(net).padEnd(12) +
      (net > 0 ? '🟢 ควรมี balance' : net < 0 ? '🔴 ออกมากกว่าเข้า' : '⚪ สมดุล')
    );
  });

  // สรุป
  const shouldHaveBalance = withActivity.filter(s => s.in - s.out > 0);
  console.log('\n' + '='.repeat(100));
  console.log('📊 สรุป:');
  console.log(`   SKUs ที่ควรมี balance > 0 (จาก ledger 19-20 ม.ค.): ${shouldHaveBalance.length}`);

  if (shouldHaveBalance.length > 0) {
    let totalExpected = 0;
    shouldHaveBalance.forEach(s => {
      const net = s.in - s.out;
      console.log(`   - ${s.location_id}/${s.sku_id}: ควรมี ${net}`);
      totalExpected += net;
    });
    console.log(`\n   รวมทั้งหมดที่ควรมี: ${totalExpected} ชิ้น`);
  }

  console.log('='.repeat(100));
}

checkActualBalance().catch(console.error);
