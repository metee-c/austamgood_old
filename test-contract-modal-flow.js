const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testContractFlow() {
  console.log('\n=== Testing Transport Contract Modal Flow ===\n');

  // Test with RP-20260122-002 (should have existing contract)
  console.log('Test 1: RP-20260122-002 (should have existing contract)');
  
  const { data: plan002, error: planError } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code')
    .eq('plan_code', 'RP-20260122-002')
    .single();

  if (planError) {
    console.error('Error fetching plan:', planError);
    return;
  }

  console.log('Plan:', plan002);

  // Get trips for this plan
  const { data: trips, error: tripsError } = await supabase
    .from('receiving_route_trips')
    .select('supplier_id, master_supplier(supplier_name)')
    .eq('plan_id', plan002.plan_id);

  if (tripsError) {
    console.error('Error fetching trips:', tripsError);
    return;
  }

  console.log('Trips:', trips.length);

  // Get unique suppliers
  const suppliers = [...new Set(trips.map(t => t.supplier_id))];
  console.log('Suppliers:', suppliers);

  // Test the function for first supplier
  const supplierId = suppliers[0];
  const supplierName = trips.find(t => t.supplier_id === supplierId)?.master_supplier?.supplier_name;

  console.log(`\nCalling get_or_create_transport_contract for supplier ${supplierId}...`);

  const { data: contractData, error: contractError } = await supabase
    .rpc('get_or_create_transport_contract', {
      p_plan_id: plan002.plan_id,
      p_supplier_id: supplierId,
      p_supplier_name: supplierName,
      p_total_trips: trips.filter(t => t.supplier_id === supplierId).length,
      p_total_cost: 0,
      p_printed_by: 'test-user'
    });

  if (contractError) {
    console.error('Error calling function:', contractError);
    return;
  }

  console.log('Contract result:', contractData);

  if (contractData && contractData.length > 0) {
    const contract = contractData[0];
    console.log('\n✅ Contract Number:', contract.contract_no);
    console.log('   Is New:', contract.is_new);
    console.log('   Total Trips:', contract.total_trips);
    console.log('   Total Cost:', contract.total_cost);
  }

  // Test with RP-20260122-005 (should create new contract)
  console.log('\n\nTest 2: RP-20260122-005 (should create new contract)');
  
  const { data: plan005, error: plan005Error } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code')
    .eq('plan_code', 'RP-20260122-005')
    .single();

  if (plan005Error) {
    console.error('Error fetching plan:', plan005Error);
    return;
  }

  console.log('Plan:', plan005);

  // Get trips for this plan
  const { data: trips005, error: trips005Error } = await supabase
    .from('receiving_route_trips')
    .select('supplier_id, master_supplier(supplier_name)')
    .eq('plan_id', plan005.plan_id);

  if (trips005Error) {
    console.error('Error fetching trips:', trips005Error);
    return;
  }

  console.log('Trips:', trips005.length);

  // Get unique suppliers
  const suppliers005 = [...new Set(trips005.map(t => t.supplier_id))];
  console.log('Suppliers:', suppliers005);

  // Test the function for first supplier
  const supplierId005 = suppliers005[0];
  const supplierName005 = trips005.find(t => t.supplier_id === supplierId005)?.master_supplier?.supplier_name;

  console.log(`\nCalling get_or_create_transport_contract for supplier ${supplierId005}...`);

  const { data: contractData005, error: contractError005 } = await supabase
    .rpc('get_or_create_transport_contract', {
      p_plan_id: plan005.plan_id,
      p_supplier_id: supplierId005,
      p_supplier_name: supplierName005,
      p_total_trips: trips005.filter(t => t.supplier_id === supplierId005).length,
      p_total_cost: 0,
      p_printed_by: 'test-user'
    });

  if (contractError005) {
    console.error('Error calling function:', contractError005);
    return;
  }

  console.log('Contract result:', contractData005);

  if (contractData005 && contractData005.length > 0) {
    const contract = contractData005[0];
    console.log('\n✅ Contract Number:', contract.contract_no);
    console.log('   Is New:', contract.is_new);
    console.log('   Total Trips:', contract.total_trips);
    console.log('   Total Cost:', contract.total_cost);
  }

  console.log('\n=== Test Complete ===\n');
}

testContractFlow().catch(console.error);
