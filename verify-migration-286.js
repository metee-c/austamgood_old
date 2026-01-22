/**
 * Verify Migration 286: Check that production/expiry dates come from latest pallet
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

async function verifyMigration() {
  try {
    console.log('🔍 Verifying Migration 286: Latest Pallet Dates\n');

    // Step 1: Get sample records from preparation_area_inventory
    console.log('Step 1: Fetching sample records from preparation_area_inventory...');
    const { data: prepRecords, error: prepError } = await supabase
      .from('preparation_area_inventory')
      .select('*')
      .not('latest_production_date', 'is', null)
      .limit(5);

    if (prepError) {
      console.error('❌ Error:', prepError);
      return;
    }

    if (!prepRecords || prepRecords.length === 0) {
      console.log('⚠️ No records with production dates found');
      return;
    }

    console.log(`✅ Found ${prepRecords.length} records with dates\n`);

    // Step 2: Verify each record
    let allPassed = true;
    for (const record of prepRecords) {
      console.log('='.repeat(60));
      console.log(`Testing: ${record.sku_id} at ${record.preparation_area_code}`);
      console.log('='.repeat(60));

      // Get all pallets for this SKU
      const { data: pallets, error: palletError } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('sku_id', record.sku_id)
        .eq('location_id', record.preparation_area_code)
        .eq('warehouse_id', record.warehouse_id)
        .order('last_movement_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (palletError || !pallets || pallets.length === 0) {
        console.log('⚠️ No pallets found in wms_inventory_balances');
        continue;
      }

      const latestPallet = pallets[0];
      
      console.log(`\nPrep Area Inventory Record:`);
      console.log(`  Latest Pallet: ${record.latest_pallet_id || 'N/A'}`);
      console.log(`  Production Date: ${record.latest_production_date || 'N/A'}`);
      console.log(`  Expiry Date: ${record.latest_expiry_date || 'N/A'}`);
      console.log(`  Lot No: ${record.latest_lot_no || 'N/A'}`);
      console.log(`  Last Movement: ${record.last_movement_at || 'N/A'}`);

      console.log(`\nLatest Pallet (from wms_inventory_balances):`);
      console.log(`  Pallet ID: ${latestPallet.pallet_id || 'N/A'}`);
      console.log(`  Production Date: ${latestPallet.production_date || 'N/A'}`);
      console.log(`  Expiry Date: ${latestPallet.expiry_date || 'N/A'}`);
      console.log(`  Lot No: ${latestPallet.lot_no || 'N/A'}`);
      console.log(`  Last Movement: ${latestPallet.last_movement_at || 'N/A'}`);

      // Check consistency
      const checks = {
        pallet_id: record.latest_pallet_id === latestPallet.pallet_id,
        production_date: record.latest_production_date === latestPallet.production_date,
        expiry_date: record.latest_expiry_date === latestPallet.expiry_date,
        lot_no: record.latest_lot_no === latestPallet.lot_no
      };

      console.log(`\nConsistency Checks:`);
      Object.entries(checks).forEach(([field, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${field}: ${passed ? 'MATCH' : 'MISMATCH'}`);
      });

      const recordPassed = Object.values(checks).every(v => v);
      if (!recordPassed) {
        allPassed = false;
      }

      console.log(`\nResult: ${recordPassed ? '✅ PASSED' : '❌ FAILED'}\n`);
    }

    console.log('='.repeat(60));
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED');
      console.log('Migration 286 is working correctly!');
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log('Please check the migration logic');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyMigration();
