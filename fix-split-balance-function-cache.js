// Fix split_balance_on_reservation function cache issue
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixFunctionCache() {
  console.log('🔧 Fixing split_balance_on_reservation function cache...\n');

  // Step 1: ตรวจสอบว่าฟังก์ชันมีอยู่
  console.log('Step 1: Checking if function exists...');
  const { data: functions, error: checkError } = await supabase
    .rpc('pg_get_functiondef', {
      funcoid: 'split_balance_on_reservation'::regproc::oid
    });

  if (checkError) {
    console.log('⚠️  Cannot check function (this is normal):', checkError.message);
  }

  // Step 2: ลองเรียกใช้ฟังก์ชันด้วยพารามิเตอร์ที่ถูกต้อง
  console.log('\nStep 2: Testing function call with correct parameters...');
  
  // ใช้ balance_id ที่มีอยู่จริงเพื่อทดสอบ (แต่จะไม่ commit)
  const { data: testBalance, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, total_piece_qty, reserved_piece_qty')
    .gt('total_piece_qty', 'reserved_piece_qty')
    .limit(1)
    .single();

  if (balanceError || !testBalance) {
    console.log('❌ Cannot find test balance:', balanceError?.message);
    return;
  }

  console.log(`Found test balance: ${testBalance.balance_id}`);
  console.log(`  Total: ${testBalance.total_piece_qty}, Reserved: ${testBalance.reserved_piece_qty}`);

  // ทดสอบเรียกใช้ฟังก์ชัน (จะ rollback ทันที)
  const { data: result, error: callError } = await supabase
    .rpc('split_balance_on_reservation', {
      p_source_balance_id: testBalance.balance_id,
      p_piece_qty_to_reserve: 1,
      p_pack_qty_to_reserve: 1,
      p_reserved_by_user_id: 1,
      p_document_type: 'test',
      p_document_id: 999999,
      p_document_code: 'TEST-CACHE',
      p_picklist_item_id: null
    });

  if (callError) {
    console.log('\n❌ Function call failed:');
    console.log('Error:', callError.message);
    console.log('\nThis suggests the function signature in cache is outdated.');
    console.log('\n💡 Solution: Run migration 302 again to refresh the function:');
    console.log('   node apply-migration-302.js');
  } else {
    console.log('\n✅ Function call successful!');
    console.log('Result:', result);
    
    // Rollback การทดสอบ
    if (result && result[0]) {
      console.log('\n🔄 Rolling back test reservation...');
      const { error: deleteError } = await supabase
        .from('wms_inventory_balances')
        .delete()
        .eq('balance_id', result[0].new_balance_id);
      
      if (!deleteError) {
        console.log('✅ Test data cleaned up');
      }
    }
  }

  // Step 3: แสดงวิธีแก้ไข
  console.log('\n' + '='.repeat(60));
  console.log('📋 SOLUTION STEPS:');
  console.log('='.repeat(60));
  console.log('\n1. Re-apply migration 302 to refresh function definition:');
  console.log('   psql -h <host> -U postgres -d postgres -f supabase/migrations/302_create_split_balance_on_reservation.sql');
  console.log('\n2. Or use Supabase CLI:');
  console.log('   supabase db reset');
  console.log('\n3. Or restart your Supabase instance to clear cache');
  console.log('\n4. If using Supabase Cloud, the function should auto-refresh');
  console.log('   but you may need to wait a few minutes for cache to clear');
}

fixFunctionCache().catch(console.error);
