require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPallet076SQL() {
  const palletId = 'ATG20260122000000076';
  
  console.log(`\n🔍 ตรวจสอบพาเลท: ${palletId}\n`);
  console.log('='.repeat(80));
  
  // 1. Check ledger with SQL
  console.log('\n1️⃣ ตรวจสอบ wms_inventory_ledger:\n');
  
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select(`
      id,
      warehouse_id,
      location_id,
      sku_id,
      pallet_id,
      piece_qty_change,
      transaction_type,
      reference_type,
      reference_id,
      created_at,
      created_by
    `)
    .eq('pallet_id', palletId)
    .order('created_at', { ascending: true });
  
  if (ledgerError) {
    console.error('❌ Ledger Error:', ledgerError);
  } else if (!ledgerData || ledgerData.length === 0) {
    console.log('❌ ไม่พบข้อมูลใน ledger');
  } else {
    console.log(`✅ พบ ${ledgerData.length} รายการใน ledger:\n`);
    
    let totalQty = 0;
    ledgerData.forEach((entry, index) => {
      console.log(`รายการที่ ${index + 1}:`);
      console.log(`  Warehouse: ${entry.warehouse_id}`);
      console.log(`  Location: ${entry.location_id}`);
      console.log(`  SKU: ${entry.sku_id}`);
      console.log(`  Piece Qty Change: ${entry.piece_qty_change}`);
      console.log(`  Transaction Type: ${entry.transaction_type}`);
      console.log(`  Reference: ${entry.reference_type} #${entry.reference_id}`);
      console.log(`  Created: ${entry.created_at}`);
      console.log('');
      
      totalQty += (entry.piece_qty_change || 0);
    });
    
    console.log(`📊 ยอดรวม: ${totalQty} ชิ้น\n`);
  }
  
  // 2. Check balance
  console.log('2️⃣ ตรวจสอบ wms_inventory_balances:\n');
  
  const { data: balanceData, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', palletId);
  
  if (balanceError) {
    console.error('❌ Balance Error:', balanceError);
  } else if (!balanceData || balanceData.length === 0) {
    console.log('❌ ไม่พบข้อมูลใน balance table\n');
  } else {
    console.log(`✅ พบ ${balanceData.length} รายการใน balance:\n`);
    balanceData.forEach(b => {
      console.log(`  Location: ${b.location_id}`);
      console.log(`  SKU: ${b.sku_id}`);
      console.log(`  Total: ${b.total_piece_qty} ชิ้น`);
      console.log(`  Reserved: ${b.reserved_piece_qty} ชิ้น`);
      console.log('');
    });
  }
  
  // 3. Check receive record
  console.log('3️⃣ ตรวจสอบ wms_receives (ใบรับสินค้า):\n');
  
  const { data: receiveData, error: receiveError } = await supabase
    .from('wms_receives')
    .select(`
      id,
      receive_number,
      status,
      created_at
    `)
    .eq('pallet_id', palletId);
  
  if (receiveError) {
    console.error('❌ Receive Error:', receiveError);
  } else if (!receiveData || receiveData.length === 0) {
    console.log('❌ ไม่พบใบรับสินค้า\n');
  } else {
    console.log(`✅ พบ ${receiveData.length} ใบรับสินค้า:\n`);
    receiveData.forEach(r => {
      console.log(`  เลขที่: ${r.receive_number}`);
      console.log(`  สถานะ: ${r.status}`);
      console.log(`  วันที่: ${r.created_at}`);
      console.log('');
    });
  }
  
  console.log('='.repeat(80));
  console.log('\n📋 สรุป:\n');
  
  const hasLedger = ledgerData && ledgerData.length > 0;
  const hasBalance = balanceData && balanceData.length > 0;
  
  if (hasLedger && !hasBalance) {
    console.log('⚠️  ปัญหา: มี ledger แต่ไม่มี balance (Data Sync Issue)');
    console.log('✅ แก้ไข: ต้องสร้าง balance records จาก ledger\n');
    
    // Calculate what needs to be inserted
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
      balanceMap[key].total_piece_qty += (entry.piece_qty_change || 0);
    });
    
    console.log('💡 ต้องสร้าง balance records:\n');
    Object.values(balanceMap).forEach(balance => {
      if (balance.total_piece_qty !== 0) {
        console.log(`  Location: ${balance.location_id}`);
        console.log(`  SKU: ${balance.sku_id}`);
        console.log(`  จำนวน: ${balance.total_piece_qty} ชิ้น\n`);
      }
    });
  } else if (!hasLedger && !hasBalance) {
    console.log('❌ ไม่พบข้อมูลเลย - พาเลทนี้อาจไม่มีในระบบ');
  } else if (hasLedger && hasBalance) {
    console.log('✅ ข้อมูลครบถ้วน - พาเลทสามารถค้นหาได้');
  }
  
  console.log('\n' + '='.repeat(80));
}

checkPallet076SQL().catch(console.error);
