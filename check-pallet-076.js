require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPallet076() {
  const palletId = 'ATG20260122000000076';
  
  console.log(`\n🔍 ตรวจสอบพาเลท: ${palletId}\n`);
  console.log('='.repeat(80));
  
  // 1. Check ledger
  console.log('\n1️⃣ ตรวจสอบ wms_inventory_ledger:');
  const { data: ledger, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('pallet_id', palletId)
    .order('created_at', { ascending: true });
  
  if (ledgerError) {
    console.error('❌ Error:', ledgerError);
  } else if (!ledger || ledger.length === 0) {
    console.log('❌ ไม่พบข้อมูลใน ledger');
  } else {
    console.log(`✅ พบ ${ledger.length} รายการใน ledger:`);
    
    // Calculate net balance by location and SKU
    const balanceMap = {};
    ledger.forEach(entry => {
      const key = `${entry.location_id}|${entry.sku_id}`;
      if (!balanceMap[key]) {
        balanceMap[key] = {
          location_id: entry.location_id,
          sku_id: entry.sku_id,
          warehouse_id: entry.warehouse_id,
          total_piece_qty: 0
        };
      }
      balanceMap[key].total_piece_qty += entry.piece_qty_change;
    });
    
    console.log('\n📊 สรุปยอดคงเหลือจาก ledger:');
    Object.values(balanceMap).forEach(balance => {
      console.log(`   Location: ${balance.location_id}`);
      console.log(`   SKU: ${balance.sku_id}`);
      console.log(`   จำนวน: ${balance.total_piece_qty} ชิ้น`);
      console.log('   ---');
    });
  }
  
  // 2. Check balance
  console.log('\n2️⃣ ตรวจสอบ wms_inventory_balances:');
  const { data: balance, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', palletId);
  
  if (balanceError) {
    console.error('❌ Error:', balanceError);
  } else if (!balance || balance.length === 0) {
    console.log('❌ ไม่พบข้อมูลใน balance table');
  } else {
    console.log(`✅ พบ ${balance.length} รายการใน balance:`);
    balance.forEach(b => {
      console.log(`   Location: ${b.location_id}`);
      console.log(`   SKU: ${b.sku_id}`);
      console.log(`   จำนวน: ${b.total_piece_qty} ชิ้น`);
      console.log(`   Reserved: ${b.reserved_piece_qty} ชิ้น`);
      console.log('   ---');
    });
  }
  
  // 3. Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 สรุป:');
  
  const hasLedger = ledger && ledger.length > 0;
  const hasBalance = balance && balance.length > 0;
  
  if (hasLedger && !hasBalance) {
    console.log('⚠️  ปัญหา: มี ledger แต่ไม่มี balance (Data Sync Issue)');
    console.log('✅ แก้ไข: ต้องสร้าง balance records จาก ledger');
    
    // Show fix command
    console.log('\n💡 คำสั่งแก้ไข:');
    console.log(`node fix-pallet-076-balance.js`);
  } else if (!hasLedger && !hasBalance) {
    console.log('❌ ไม่พบข้อมูลเลย - พาเลทนี้อาจไม่มีในระบบ');
  } else if (hasLedger && hasBalance) {
    console.log('✅ ข้อมูลครบถ้วน - พาเลทสามารถค้นหาได้');
  }
  
  console.log('\n' + '='.repeat(80));
}

checkPallet076().catch(console.error);
