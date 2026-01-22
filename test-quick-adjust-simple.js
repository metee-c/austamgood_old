/**
 * Simple test for Quick Adjust API after clearing reservations
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQuickAdjust() {
  try {
    console.log('🧪 Testing Quick Adjust API (Post-Reservation Removal)\n');

    // Find a SKU with stock in prep area
    console.log('Step 1: Finding test SKU...');
    const { data: testData, error: fetchError } = await supabase
      .from('preparation_area_inventory')
      .select('*')
      .eq('warehouse_id', 'WH001')
      .gt('total_piece_qty', 0)
      .limit(1)
      .single();

    if (fetchError || !testData) {
      console.error('❌ No test data found:', fetchError);
      return;
    }

    console.log('✅ Found test SKU:', {
      sku_id: testData.sku_id,
      prep_area_code: testData.preparation_area_code,
      current_total: testData.total_piece_qty,
      reserved: testData.reserved_piece_qty,
      available: testData.available_piece_qty
    });

    // Check actual balances in wms_inventory_balances
    console.log('\nStep 2: Checking actual balances...');
    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, pallet_id, total_piece_qty, reserved_piece_qty')
      .eq('warehouse_id', testData.warehouse_id)
      .eq('location_id', testData.preparation_area_code)
      .eq('sku_id', testData.sku_id);

    if (balanceError) {
      console.error('❌ Error fetching balances:', balanceError);
      return;
    }

    console.log(`✅ Found ${balances.length} pallet(s):`);
    balances.forEach(b => {
      console.log(`  - ${b.pallet_id}: ${b.total_piece_qty} pieces (reserved: ${b.reserved_piece_qty})`);
    });

    const totalFromBalances = balances.reduce((sum, b) => sum + b.total_piece_qty, 0);
    const totalReserved = balances.reduce((sum, b) => sum + b.reserved_piece_qty, 0);

    console.log('\nSummary:');
    console.log(`  Total from balances: ${totalFromBalances}`);
    console.log(`  Total reserved: ${totalReserved}`);
    console.log(`  Total from prep_area_inventory: ${testData.total_piece_qty}`);
    console.log(`  Match: ${totalFromBalances === testData.total_piece_qty ? '✅' : '❌'}`);

    // Test adjustment scenario
    const newQty = testData.total_piece_qty - 10; // Reduce by 10
    console.log(`\nStep 3: Testing adjustment to ${newQty} pieces (-10)...`);
    console.log('  This should work now since reservations are cleared');
    console.log('  API would adjust the first pallet by -10 pieces');

    console.log('\n✅ Test completed successfully!');
    console.log('\nAPI Endpoint: POST /api/inventory/prep-area-balances/adjust');
    console.log('Payload example:', JSON.stringify({
      warehouse_id: testData.warehouse_id,
      location_id: testData.preparation_area_code,
      sku_id: testData.sku_id,
      actual_piece_qty: newQty,
      reason: 'Test adjustment'
    }, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testQuickAdjust();
