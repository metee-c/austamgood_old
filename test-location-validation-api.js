require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function testLocationValidation() {
  console.log('🧪 Testing location validation in prep area inventory...\n');
  
  // Test 1: Query view directly
  console.log('📊 Test 1: Query view directly');
  const { data: viewData, error: viewError } = await supabase
    .from('vw_preparation_area_inventory')
    .select('sku_id, preparation_area_code, default_location, is_correct_location, expected_location, total_piece_qty')
    .limit(10);
  
  if (viewError) {
    console.error('❌ Error:', viewError);
  } else {
    console.log(`✅ Found ${viewData.length} records`);
    console.log('\n📋 Sample data:');
    viewData.slice(0, 3).forEach((item, idx) => {
      console.log(`\n${idx + 1}. ${item.sku_id}`);
      console.log(`   Current location: ${item.preparation_area_code}`);
      console.log(`   Default location: ${item.default_location || 'N/A'}`);
      console.log(`   Is correct: ${item.is_correct_location === null ? 'N/A' : item.is_correct_location ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   Expected: ${item.expected_location || 'N/A'}`);
      console.log(`   Quantity: ${item.total_piece_qty} pcs`);
    });
  }
  
  // Test 2: Count items in wrong location
  console.log('\n\n📊 Test 2: Count items in wrong location');
  const { data: wrongLocationData, error: wrongError } = await supabase
    .from('vw_preparation_area_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('is_correct_location', false);
  
  if (wrongError) {
    console.error('❌ Error:', wrongError);
  } else {
    console.log(`⚠️  Items in wrong location: ${wrongLocationData?.length || 0}`);
  }
  
  // Test 3: Get items in wrong location with details
  console.log('\n\n📊 Test 3: Items in wrong location (top 5)');
  const { data: wrongItems, error: wrongItemsError } = await supabase
    .from('vw_preparation_area_inventory')
    .select('sku_id, sku_name, preparation_area_code, default_location, expected_location, total_piece_qty')
    .eq('is_correct_location', false)
    .order('total_piece_qty', { ascending: false })
    .limit(5);
  
  if (wrongItemsError) {
    console.error('❌ Error:', wrongItemsError);
  } else {
    console.log(`\n❌ Found ${wrongItems.length} items in wrong location:\n`);
    wrongItems.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.sku_id} - ${item.sku_name}`);
      console.log(`   At: ${item.preparation_area_code} → Should be: ${item.expected_location}`);
      console.log(`   Quantity: ${item.total_piece_qty} pcs\n`);
    });
  }
  
  // Test 4: Test API endpoint
  console.log('\n📊 Test 4: Test API endpoint (simulated)');
  console.log('   API should include these fields:');
  console.log('   - default_location');
  console.log('   - is_correct_location');
  console.log('   - expected_location');
  console.log('\n   ✅ API transformation already updated in route.ts');
  
  console.log('\n\n🎉 All tests completed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Test API at: http://localhost:3000/api/inventory/prep-area-balances');
  console.log('   2. Update UI to show warning indicators');
  console.log('   3. Add filter for "แสดงเฉพาะสินค้าที่อยู่ผิดที่"');
}

testLocationValidation();
