require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPrepAreaInventoryData() {
  console.log('🔍 Testing preparation_area_inventory data integrity...\n');

  // Test 1: Check for duplicate SKUs in same location
  console.log('📋 Test 1: Checking for duplicate SKUs in same location');
  const { data: duplicates, error: dupError } = await supabase.rpc('check_prep_area_duplicates', {}, {
    count: 'exact'
  });

  // Manual query since RPC might not exist
  const { data: manualCheck, error: manualError } = await supabase
    .from('preparation_area_inventory')
    .select('warehouse_id, preparation_area_code, sku_id, count')
    .order('warehouse_id')
    .order('preparation_area_code')
    .order('sku_id');

  if (manualError) {
    console.error('❌ Error checking duplicates:', manualError);
  } else {
    // Group by location + SKU to find duplicates
    const grouped = {};
    for (const row of manualCheck || []) {
      const key = `${row.warehouse_id}|${row.preparation_area_code}|${row.sku_id}`;
      grouped[key] = (grouped[key] || 0) + 1;
    }

    const dups = Object.entries(grouped).filter(([key, count]) => count > 1);
    if (dups.length > 0) {
      console.log('❌ Found duplicate SKUs in same location:');
      dups.forEach(([key, count]) => {
        console.log(`   ${key}: ${count} rows`);
      });
    } else {
      console.log('✅ No duplicates found - each SKU appears once per location');
    }
  }

  // Test 2: Check location A09-01-001 specifically
  console.log('\n📋 Test 2: Checking location A09-01-001');
  const { data: a09Data, error: a09Error } = await supabase
    .from('preparation_area_inventory')
    .select('*')
    .eq('preparation_area_code', 'A09-01-001')
    .order('sku_id');

  if (a09Error) {
    console.error('❌ Error:', a09Error);
  } else {
    console.log(`✅ Found ${a09Data.length} SKUs in A09-01-001:`);
    a09Data.forEach(row => {
      console.log(`   - ${row.sku_id}: ${row.total_piece_qty} pieces (${row.total_pack_qty} packs)`);
    });
  }

  // Test 3: Check view data
  console.log('\n📋 Test 3: Checking view vw_preparation_area_inventory for A09-01-001');
  const { data: viewData, error: viewError } = await supabase
    .from('vw_preparation_area_inventory')
    .select('*')
    .eq('preparation_area_code', 'A09-01-001')
    .order('sku_id');

  if (viewError) {
    console.error('❌ Error:', viewError);
  } else {
    console.log(`✅ View shows ${viewData.length} SKUs in A09-01-001:`);
    viewData.forEach(row => {
      console.log(`   - ${row.sku_id} (${row.sku_name}): ${row.total_piece_qty} pieces`);
    });
  }

  // Test 4: Check wms_inventory_balances for comparison
  console.log('\n📋 Test 4: Checking wms_inventory_balances for A09-01-001');
  const { data: balanceData, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, pallet_id, total_piece_qty, total_pack_qty')
    .eq('location_id', 'A09-01-001')
    .order('sku_id');

  if (balanceError) {
    console.error('❌ Error:', balanceError);
  } else {
    console.log(`✅ wms_inventory_balances shows ${balanceData.length} pallet records in A09-01-001:`);
    
    // Group by SKU
    const skuGroups = {};
    balanceData.forEach(row => {
      if (!skuGroups[row.sku_id]) {
        skuGroups[row.sku_id] = { pallets: 0, total_pieces: 0, total_packs: 0 };
      }
      skuGroups[row.sku_id].pallets++;
      skuGroups[row.sku_id].total_pieces += row.total_piece_qty || 0;
      skuGroups[row.sku_id].total_packs += row.total_pack_qty || 0;
    });

    Object.entries(skuGroups).forEach(([sku_id, stats]) => {
      console.log(`   - ${sku_id}: ${stats.pallets} pallets, ${stats.total_pieces} pieces total`);
    });
  }

  console.log('\n✅ Test complete!');
}

testPrepAreaInventoryData().catch(console.error);
