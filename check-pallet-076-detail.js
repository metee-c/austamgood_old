require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPallet076Detail() {
  const palletId = 'ATG20260122000000076';
  
  console.log(`\n🔍 ตรวจสอบรายละเอียดพาเลท: ${palletId}\n`);
  
  // Get ledger entries with all details
  const { data: ledger, error } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('pallet_id', palletId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!ledger || ledger.length === 0) {
    console.log('❌ ไม่พบข้อมูลใน ledger');
    return;
  }
  
  console.log(`✅ พบ ${ledger.length} รายการใน ledger:\n`);
  
  ledger.forEach((entry, index) => {
    console.log(`รายการที่ ${index + 1}:`);
    console.log(`  ID: ${entry.id}`);
    console.log(`  Warehouse: ${entry.warehouse_id}`);
    console.log(`  Location: ${entry.location_id}`);
    console.log(`  SKU: ${entry.sku_id}`);
    console.log(`  Pallet: ${entry.pallet_id}`);
    console.log(`  Piece Qty Change: ${entry.piece_qty_change}`);
    console.log(`  Transaction Type: ${entry.transaction_type}`);
    console.log(`  Reference Type: ${entry.reference_type}`);
    console.log(`  Reference ID: ${entry.reference_id}`);
    console.log(`  Created At: ${entry.created_at}`);
    console.log(`  Created By: ${entry.created_by}`);
    console.log('  ---\n');
  });
  
  // Calculate balance
  console.log('📊 คำนวณยอดคงเหลือ:\n');
  
  const balanceMap = {};
  ledger.forEach(entry => {
    const key = `${entry.warehouse_id}|${entry.location_id}|${entry.sku_id}`;
    if (!balanceMap[key]) {
      balanceMap[key] = {
        warehouse_id: entry.warehouse_id,
        location_id: entry.location_id,
        sku_id: entry.sku_id,
        pallet_id: entry.pallet_id,
        total_piece_qty: 0,
        entries: []
      };
    }
    
    const qty = parseInt(entry.piece_qty_change) || 0;
    balanceMap[key].total_piece_qty += qty;
    balanceMap[key].entries.push({
      type: entry.transaction_type,
      qty: qty,
      date: entry.created_at
    });
  });
  
  Object.values(balanceMap).forEach(balance => {
    console.log(`Location: ${balance.location_id}`);
    console.log(`SKU: ${balance.sku_id}`);
    console.log(`Warehouse: ${balance.warehouse_id}`);
    console.log(`Pallet: ${balance.pallet_id}`);
    console.log(`Total: ${balance.total_piece_qty} ชิ้น`);
    console.log(`Transactions:`);
    balance.entries.forEach(e => {
      console.log(`  - ${e.type}: ${e.qty > 0 ? '+' : ''}${e.qty} (${e.date})`);
    });
    console.log('  ---\n');
  });
  
  // Check if we need to create balance
  console.log('💡 ต้องสร้าง balance records:');
  Object.values(balanceMap).forEach(balance => {
    if (balance.total_piece_qty > 0) {
      console.log(`\nINSERT INTO wms_inventory_balances (`);
      console.log(`  warehouse_id, location_id, sku_id, pallet_id,`);
      console.log(`  total_piece_qty, reserved_piece_qty`);
      console.log(`) VALUES (`);
      console.log(`  '${balance.warehouse_id}', '${balance.location_id}', '${balance.sku_id}', '${balance.pallet_id}',`);
      console.log(`  ${balance.total_piece_qty}, 0`);
      console.log(`);`);
    }
  });
}

checkPallet076Detail().catch(console.error);
