require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixPallet039() {
  const palletId = 'ATG20260122000000039';
  
  console.log(`\n🔧 แก้ไข Balance สำหรับ Pallet: ${palletId}\n`);
  
  // 1. ดึง ledger entries ทั้งหมด
  console.log('1️⃣ ดึง ledger entries:');
  const { data: ledgers, error: ledError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('pallet_id', palletId)
    .order('created_at', { ascending: true });
  
  if (ledError) {
    console.error('❌ Error:', ledError.message);
    return;
  }
  
  if (!ledgers || ledgers.length === 0) {
    console.log('❌ ไม่พบ ledger entries');
    return;
  }
  
  console.log(`✅ พบ ${ledgers.length} ledger entries`);
  
  // 2. คำนวณ balance จาก ledger
  const balanceMap = new Map();
  
  ledgers.forEach(entry => {
    const key = `${entry.sku_id}_${entry.location_id}_${entry.production_date || ''}_${entry.expiry_date || ''}`;
    
    if (!balanceMap.has(key)) {
      balanceMap.set(key, {
        sku_id: entry.sku_id,
        location_id: entry.location_id,
        pallet_id: entry.pallet_id,
        warehouse_id: entry.warehouse_id,
        production_date: entry.production_date,
        expiry_date: entry.expiry_date,
        total_piece_qty: 0,
        total_pack_qty: 0,
      });
    }
    
    const balance = balanceMap.get(key);
    balance.total_piece_qty += entry.quantity_change || 0;
    balance.total_pack_qty += entry.pack_quantity_change || 0;
    
    console.log(`   ${entry.transaction_type}: ${entry.quantity_change > 0 ? '+' : ''}${entry.quantity_change} ชิ้น @ ${entry.location_id}`);
  });
  
  // 3. แสดง balance ที่คำนวณได้
  console.log('\n2️⃣ Balance ที่คำนวณจาก ledger:');
  const balancesToCreate = [];
  
  for (const [key, balance] of balanceMap.entries()) {
    if (balance.total_piece_qty > 0) {
      console.log(`   ✅ SKU: ${balance.sku_id}, Location: ${balance.location_id}, Qty: ${balance.total_piece_qty} ชิ้น`);
      balancesToCreate.push(balance);
    } else {
      console.log(`   ⏭️  SKU: ${balance.sku_id}, Location: ${balance.location_id}, Qty: ${balance.total_piece_qty} ชิ้น (ข้าม - qty = 0)`);
    }
  }
  
  if (balancesToCreate.length === 0) {
    console.log('\n⚠️  ไม่มี balance ที่ต้องสร้าง (qty ทั้งหมดเป็น 0)');
    return;
  }
  
  // 4. สร้าง balance records
  console.log(`\n3️⃣ สร้าง ${balancesToCreate.length} balance records:`);
  
  const { data: created, error: createError } = await supabase
    .from('wms_inventory_balances')
    .insert(balancesToCreate)
    .select();
  
  if (createError) {
    console.error('❌ Error creating balances:', createError.message);
    return;
  }
  
  console.log(`✅ สร้าง balance สำเร็จ ${created.length} records`);
  
  // 5. Verify
  console.log('\n4️⃣ ตรวจสอบ balance หลังแก้ไข:');
  const { data: finalBalances } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', palletId);
  
  if (finalBalances && finalBalances.length > 0) {
    console.log(`✅ พบ ${finalBalances.length} balance records:`);
    finalBalances.forEach(b => {
      console.log(`   - SKU: ${b.sku_id}, Location: ${b.location_id}, Qty: ${b.total_piece_qty} ชิ้น`);
    });
  }
  
  console.log('\n✅ เสร็จสิ้น!');
}

fixPallet039().catch(console.error);
