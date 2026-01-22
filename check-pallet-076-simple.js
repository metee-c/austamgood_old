require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPallet076Simple() {
  const palletId = 'ATG20260122000000076';
  
  console.log(`\n🔍 ตรวจสอบพาเลท: ${palletId}\n`);
  console.log('='.repeat(80));
  
  // 1. Check ledger - select all columns
  console.log('\n1️⃣ ตรวจสอบ wms_inventory_ledger:\n');
  
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('pallet_id', palletId)
    .order('created_at', { ascending: true });
  
  if (ledgerError) {
    console.error('❌ Ledger Error:', ledgerError);
  } else if (!ledgerData || ledgerData.length === 0) {
    console.log('❌ ไม่พบข้อมูลใน ledger');
  } else {
    console.log(`✅ พบ ${ledgerData.length} รายการใน ledger:\n`);
    console.log(JSON.stringify(ledgerData, null, 2));
  }
  
  // 2. Check balance
  console.log('\n2️⃣ ตรวจสอบ wms_inventory_balances:\n');
  
  const { data: balanceData, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', palletId);
  
  if (balanceError) {
    console.error('❌ Balance Error:', balanceError);
  } else if (!balanceData || balanceData.length === 0) {
    console.log('❌ ไม่พบข้อมูลใน balance table\n');
  } else {
    console.log(`✅ พบ ${balanceData.length} รายการ:\n`);
    console.log(JSON.stringify(balanceData, null, 2));
  }
  
  console.log('\n' + '='.repeat(80));
}

checkPallet076Simple().catch(console.error);
