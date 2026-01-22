const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPrepAreaAPI() {
  console.log('🧪 Testing Preparation Area Inventory API\n');

  try {
    // Test 1: Query the view directly
    console.log('📊 Test 1: Query vw_preparation_area_inventory directly');
    const { data: viewData, error: viewError } = await supabase
      .from('vw_preparation_area_inventory')
      .select('*')
      .limit(5);

    if (viewError) {
      console.error('❌ View query error:', viewError);
    } else {
      console.log(`✅ View query successful: ${viewData.length} rows`);
      console.log('Sample data:', JSON.stringify(viewData[0], null, 2));
    }

    console.log('\n---\n');

    // Test 2: Query with warehouse filter
    console.log('📊 Test 2: Query with warehouse filter (WH001)');
    const { data: filteredData, error: filteredError } = await supabase
      .from('vw_preparation_area_inventory')
      .select('*')
      .eq('warehouse_id', 'WH001')
      .limit(5);

    if (filteredError) {
      console.error('❌ Filtered query error:', filteredError);
    } else {
      console.log(`✅ Filtered query successful: ${filteredData.length} rows`);
    }

    console.log('\n---\n');

    // Test 3: Query PK001 (regular prep area)
    console.log('📊 Test 3: Query PK001 (บ้านหยิบ)');
    const { data: pk001Data, error: pk001Error } = await supabase
      .from('vw_preparation_area_inventory')
      .select('*')
      .eq('preparation_area_code', 'PK001')
      .limit(5);

    if (pk001Error) {
      console.error('❌ PK001 query error:', pk001Error);
    } else {
      console.log(`✅ PK001 query successful: ${pk001Data.length} rows`);
      console.log('Sample SKU:', pk001Data[0]?.sku_id, '-', pk001Data[0]?.sku_name);
      console.log('Total pieces:', pk001Data[0]?.total_piece_qty);
      console.log('Available pieces:', pk001Data[0]?.available_piece_qty);
      console.log('Latest production date:', pk001Data[0]?.latest_production_date);
      console.log('Latest expiry date:', pk001Data[0]?.latest_expiry_date);
    }

    console.log('\n---\n');

    // Test 4: Query PK002 (premium prep area)
    console.log('📊 Test 4: Query PK002 (บ้านหยิบพรีเมี่ยม)');
    const { data: pk002Data, error: pk002Error } = await supabase
      .from('vw_preparation_area_inventory')
      .select('*')
      .eq('preparation_area_code', 'PK002')
      .limit(5);

    if (pk002Error) {
      console.error('❌ PK002 query error:', pk002Error);
    } else {
      console.log(`✅ PK002 query successful: ${pk002Data.length} rows`);
      if (pk002Data.length > 0) {
        console.log('Sample SKU:', pk002Data[0]?.sku_id, '-', pk002Data[0]?.sku_name);
        console.log('Total pieces:', pk002Data[0]?.total_piece_qty);
      }
    }

    console.log('\n---\n');

    // Test 5: Count total rows
    console.log('📊 Test 5: Count total rows');
    const { count, error: countError } = await supabase
      .from('vw_preparation_area_inventory')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count error:', countError);
    } else {
      console.log(`✅ Total rows in view: ${count}`);
    }

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testPrepAreaAPI();
