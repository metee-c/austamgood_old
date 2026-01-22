require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPallet076Raw() {
  const palletId = 'ATG20260122000000076';
  
  console.log(`\n🔍 ตรวจสอบข้อมูล RAW พาเลท: ${palletId}\n`);
  
  // Get ALL columns from ledger
  const { data: ledger, error } = await supabase
    .rpc('execute_sql', {
      query: `
        SELECT *
        FROM wms_inventory_ledger
        WHERE pallet_id = '${palletId}'
        ORDER BY created_at;
      `
    });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log('📊 ข้อมูลทั้งหมดจาก ledger:');
  console.log(JSON.stringify(ledger, null, 2));
  
  // Also check balance
  const { data: balance, error: balanceError } = await supabase
    .rpc('execute_sql', {
      query: `
        SELECT *
        FROM wms_inventory_balances
        WHERE pallet_id = '${palletId}';
      `
    });
  
  if (balanceError) {
    console.error('❌ Balance Error:', balanceError);
  } else {
    console.log('\n📊 ข้อมูลจาก balance:');
    console.log(JSON.stringify(balance, null, 2));
  }
}

checkPallet076Raw().catch(console.error);
