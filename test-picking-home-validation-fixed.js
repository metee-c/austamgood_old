/**
 * Test script to verify picking home validation is working
 * Tests the fixed API endpoint and validation logic
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testPickingHomeValidation() {
  console.log('=== Testing Picking Home Validation (Fixed) ===\n');

  // Test 1: Check if A10-01-002 is a picking home
  console.log('Test 1: Check if A10-01-002 is a picking home');
  try {
    const response = await fetch(`http://localhost:3000/api/sku-preparation-area-mapping?location_code=A10-01-002`);
    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    const isPickingHome = result.data && result.data.length > 0;
    console.log('Is A10-01-002 a picking home?', isPickingHome ? 'YES ✓' : 'NO ✗');
    console.log('');
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 2: Check if PK001 is a picking home
  console.log('Test 2: Check if PK001 is a picking home');
  try {
    const response = await fetch(`http://localhost:3000/api/sku-preparation-area-mapping?location_code=PK001`);
    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    const isPickingHome = result.data && result.data.length > 0;
    console.log('Is PK001 a picking home?', isPickingHome ? 'YES ✓' : 'NO ✗');
    console.log('');
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 3: Check a bulk storage location (should NOT be picking home)
  console.log('Test 3: Check if AA-BLK-27 is a picking home (should be NO)');
  try {
    const response = await fetch(`http://localhost:3000/api/sku-preparation-area-mapping?location_code=AA-BLK-27`);
    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    const isPickingHome = result.data && result.data.length > 0;
    console.log('Is AA-BLK-27 a picking home?', isPickingHome ? 'YES ✗ (WRONG!)' : 'NO ✓ (CORRECT)');
    console.log('');
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 4: Get SKU default_location from pallet ATG2500016115
  console.log('Test 4: Get SKU default_location from pallet ATG2500016115');
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: balances, error } = await supabase
      .from('wms_inventory_balances')
      .select(`
        sku_id,
        pallet_id,
        pallet_id_external,
        total_piece_qty,
        master_sku!sku_id (
          sku_id,
          sku_name,
          default_location
        )
      `)
      .eq('pallet_id_external', 'ATG2500016115')
      .gt('total_piece_qty', 0);

    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log('Pallet data:');
      balances.forEach(item => {
        console.log(`  SKU: ${item.sku_id}`);
        console.log(`  Name: ${item.master_sku?.sku_name || 'N/A'}`);
        console.log(`  Default Location: ${item.master_sku?.default_location || 'NONE'}`);
        console.log(`  Qty: ${item.total_piece_qty}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('=== Test Complete ===');
}

testPickingHomeValidation().catch(console.error);
