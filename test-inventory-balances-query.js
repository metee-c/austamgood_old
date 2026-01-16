require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testQuery() {
  console.log('=== ทดสอบ Query Syntax ===\n');

  const excludeLocations = ['RCV', 'SHIP', 'Dispatch', 'Delivery-In-Progress'];

  // Test 1: Current (wrong) syntax
  console.log('1. Current syntax (WRONG):');
  const wrongSyntax = `(${excludeLocations.join(',')})`;
  console.log(`   .not('location_id', 'in', '${wrongSyntax}')`);
  
  const { data: data1, error: error1 } = await supabase
    .from('wms_inventory_balances')
    .select('location_id')
    .eq('location_id', 'AA-BLK-27')
    .not('location_id', 'in', wrongSyntax)
    .limit(5);
  
  console.log(`   Result: ${data1?.length || 0} rows`);
  if (error1) console.log(`   Error: ${error1.message}`);

  // Test 2: Correct syntax
  console.log('\n2. Correct syntax:');
  const correctSyntax = `(${excludeLocations.map(loc => `"${loc}"`).join(',')})`;
  console.log(`   .not('location_id', 'in', '${correctSyntax}')`);
  
  const { data: data2, error: error2 } = await supabase
    .from('wms_inventory_balances')
    .select('location_id')
    .eq('location_id', 'AA-BLK-27')
    .not('location_id', 'in', correctSyntax)
    .limit(5);
  
  console.log(`   Result: ${data2?.length || 0} rows`);
  if (error2) console.log(`   Error: ${error2.message}`);

  // Test 3: Check if AA-BLK-27 exists without filter
  console.log('\n3. Without .not() filter:');
  const { data: data3 } = await supabase
    .from('wms_inventory_balances')
    .select('location_id')
    .eq('location_id', 'AA-BLK-27')
    .limit(5);
  
  console.log(`   Result: ${data3?.length || 0} rows`);
}

testQuery().catch(console.error);
