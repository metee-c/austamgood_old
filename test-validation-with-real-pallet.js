const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testValidation() {
  // Find SKU with picking home and its pallet
  const testSku = 'B-BEY-C|SAL|NS|010';
  
  // Get its designated picking home
  const { data: mapping } = await supabase
    .from('sku_preparation_area_mapping')
    .select(`
      sku_id,
      preparation_area_id,
      preparation_area!inner (
        area_code,
        area_name
      )
    `)
    .eq('sku_id', testSku)
    .order('priority', { ascending: true })
    .limit(1)
    .single();

  if (!mapping) {
    console.log('SKU does not have a picking home');
    return;
  }

  const pickingHome = mapping.preparation_area.area_code;
  console.log(`=== Test SKU: ${testSku} ===`);
  console.log(`Designated Picking Home: ${pickingHome}`);

  // Find a pallet with this SKU
  const { data: pallet } = await supabase
    .from('wms_inventory_balances')
    .select('pallet_id, pallet_id_external, total_piece_qty, location_id, master_location(location_code)')
    .eq('sku_id', testSku)
    .gt('total_piece_qty', 0)
    .limit(1)
    .single();

  if (!pallet) {
    console.log('No pallet found with stock');
    return;
  }

  console.log(`\n=== Pallet: ${pallet.pallet_id} ===`);
  console.log(`Current Location: ${pallet.master_location?.location_code}`);
  console.log(`Quantity: ${pallet.total_piece_qty}`);

  // Get location_id for picking home
  const { data: pickingHomeLoc } = await supabase
    .from('master_location')
    .select('location_id, location_code')
    .eq('location_code', pickingHome)
    .single();

  // Get location_id for bulk storage
  const { data: bulkLoc } = await supabase
    .from('master_location')
    .select('location_id, location_code')
    .eq('location_code', 'A01-01-002')
    .single();

  // Get location_id for wrong picking home
  const { data: wrongHomeLoc } = await supabase
    .from('master_location')
    .select('location_id, location_code')
    .eq('location_code', 'A10-01-001') // B-BEY-C|MNB|NS|010's home
    .single();

  console.log(`\n=== Test Scenarios ===`);
  
  // Test 1: Move to its own picking home (should ALLOW)
  if (pickingHomeLoc) {
    console.log(`\n1. Move to own picking home (${pickingHome}):`);
    const response1 = await fetch('http://localhost:3000/api/moves/quick-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pallet_id: pallet.pallet_id,
        to_location_id: pickingHomeLoc.location_id,
        notes: 'Test: Move to own home'
      })
    });
    const result1 = await response1.json();
    console.log(`Status: ${response1.status}`);
    console.log(`Result: ${result1.error || 'SUCCESS'}`);
  }

  // Test 2: Move to wrong picking home (should BLOCK)
  if (wrongHomeLoc) {
    console.log(`\n2. Move to wrong picking home (${wrongHomeLoc.location_code}):`);
    const response2 = await fetch('http://localhost:3000/api/moves/quick-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pallet_id: pallet.pallet_id,
        to_location_id: wrongHomeLoc.location_id,
        notes: 'Test: Move to wrong home'
      })
    });
    const result2 = await response2.json();
    console.log(`Status: ${response2.status}`);
    console.log(`Result: ${result2.error || 'SUCCESS'}`);
  }

  // Test 3: Move to bulk storage (should ALLOW)
  if (bulkLoc) {
    console.log(`\n3. Move to bulk storage (${bulkLoc.location_code}):`);
    const response3 = await fetch('http://localhost:3000/api/moves/quick-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pallet_id: pallet.pallet_id,
        to_location_id: bulkLoc.location_id,
        notes: 'Test: Move to bulk storage'
      })
    });
    const result3 = await response3.json();
    console.log(`Status: ${response3.status}`);
    console.log(`Result: ${result3.error || 'SUCCESS'}`);
  }
}

testValidation().catch(console.error);
