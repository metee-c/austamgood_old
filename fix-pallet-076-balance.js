require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPallet076Balance() {
  const palletId = 'ATG20260122000000076';
  
  console.log(`\n🔧 แก้ไขปัญหา Balance สำหรับพาเลท: ${palletId}\n`);
  console.log('='.repeat(80));
  
  // 1. Get ledger data
  console.log('\n1️⃣ ดึงข้อมูลจาก ledger...\n');
  
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('pallet_id', palletId);
  
  if (ledgerError) {
    console.error('❌ Error:', ledgerError);
    return;
  }
  
  if (!ledgerData || ledgerData.length === 0) {
    console.log('❌ ไม่พบข้อมูลใน ledger - ไม่สามารถแก้ไขได้');
    return;
  }
  
  console.log(`✅ พบ ${ledgerData.length} รายการใน ledger`);
  
  // 2. Calculate balance by location + SKU
  console.log('\n2️⃣ คำนวณยอดคงเหลือ...\n');
  
  const balanceMap = {};
  ledgerData.forEach(entry => {
    const key = `${entry.warehouse_id}|${entry.location_id}|${entry.sku_id}`;
    if (!balanceMap[key]) {
      balanceMap[key] = {
        warehouse_id: entry.warehouse_id,
        location_id: entry.location_id,
        sku_id: entry.sku_id,
        pallet_id: entry.pallet_id,
        total_piece_qty: 0
      };
    }
    
    // Use piece_qty from ledger
    const qty = entry.piece_qty || 0;
    balanceMap[key].total_piece_qty += qty;
  });
  
  const balancesToInsert = Object.values(balanceMap).filter(b => b.total_piece_qty !== 0);
  
  if (balancesToInsert.length === 0) {
    console.log('⚠️  ไม่มียอดคงเหลือที่ต้องสร้าง (ยอดเป็น 0)');
    return;
  }
  
  console.log(`📊 ต้องสร้าง ${balancesToInsert.length} balance records:\n`);
  balancesToInsert.forEach(balance => {
    console.log(`  Location: ${balance.location_id}`);
    console.log(`  SKU: ${balance.sku_id}`);
    console.log(`  Pallet: ${balance.pallet_id}`);
    console.log(`  จำนวน: ${balance.total_piece_qty} ชิ้น`);
    console.log('');
  });
  
  // 3. Insert balance records
  console.log('3️⃣ สร้าง balance records...\n');
  
  const recordsToInsert = balancesToInsert.map(balance => ({
    warehouse_id: balance.warehouse_id,
    location_id: balance.location_id,
    sku_id: balance.sku_id,
    pallet_id: balance.pallet_id,
    total_piece_qty: balance.total_piece_qty,
    reserved_piece_qty: 0
  }));
  
  const { data: insertedData, error: insertError } = await supabase
    .from('wms_inventory_balances')
    .insert(recordsToInsert)
    .select();
  
  if (insertError) {
    console.error('❌ Insert Error:', insertError);
    return;
  }
  
  console.log(`✅ สร้าง ${insertedData.length} balance records สำเร็จ!\n`);
  
  // 4. Verify
  console.log('4️⃣ ตรวจสอบผลลัพธ์...\n');
  
  const { data: verifyData, error: verifyError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', palletId);
  
  if (verifyError) {
    console.error('❌ Verify Error:', verifyError);
    return;
  }
  
  console.log(`✅ พบ ${verifyData.length} balance records:\n`);
  verifyData.forEach(b => {
    console.log(`  Location: ${b.location_id}`);
    console.log(`  SKU: ${b.sku_id}`);
    console.log(`  Total: ${b.total_piece_qty} ชิ้น`);
    console.log(`  Reserved: ${b.reserved_piece_qty} ชิ้น`);
    console.log('');
  });
  
  console.log('='.repeat(80));
  console.log('\n✅ แก้ไขเสร็จสมบูรณ์!\n');
  console.log(`🎉 พาเลท ${palletId} สามารถค้นหาได้แล้ว\n`);
  console.log('='.repeat(80));
}

fixPallet076Balance().catch(console.error);
