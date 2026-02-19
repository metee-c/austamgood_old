// Test script to verify inventory ledger query
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testQuery() {
  console.log('Testing inventory ledger query...\n');

  // Test 1: Simple count
  console.log('Test 1: Count all records');
  const { count, error: countError } = await supabase
    .from('wms_inventory_ledger')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Count error:', countError);
  } else {
    console.log('✅ Total records:', count);
  }

  // Test 2: Fetch first 10 records
  console.log('\nTest 2: Fetch first 10 records');
  const { data, error } = await supabase
    .from('wms_inventory_ledger')
    .select(`
      *,
      master_location (
        location_name
      ),
      master_sku (
        sku_name,
        weight_per_piece_kg
      ),
      wms_move_items (
        parent_pallet_id,
        new_pallet_id,
        to_location_id
      ),
      master_system_user (
        username,
        full_name
      ),
      wms_orders (
        order_no
      )
    `)
    .order('ledger_id', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Query error:', error);
  } else {
    console.log('✅ Fetched records:', data?.length);
    if (data && data.length > 0) {
      console.log('\nSample record:');
      console.log(JSON.stringify(data[0], null, 2));
    }
  }

  // Test 3: Check if there are any filters that might be blocking
  console.log('\nTest 3: Check recent records (last 7 days)');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: recentData, error: recentError } = await supabase
    .from('wms_inventory_ledger')
    .select('ledger_id, movement_at, transaction_type, direction')
    .gte('movement_at', sevenDaysAgo.toISOString())
    .order('movement_at', { ascending: false })
    .limit(5);

  if (recentError) {
    console.error('❌ Recent records error:', recentError);
  } else {
    console.log('✅ Recent records (last 7 days):', recentData?.length);
    if (recentData && recentData.length > 0) {
      console.log('Latest records:');
      recentData.forEach(r => {
        console.log(`  - ID: ${r.ledger_id}, Date: ${r.movement_at}, Type: ${r.transaction_type}, Direction: ${r.direction}`);
      });
    }
  }
}

testQuery().catch(console.error);
