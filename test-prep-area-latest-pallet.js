/**
 * Test script to verify preparation area inventory shows correct latest pallet dates
 * 
 * This script checks that production_date and expiry_date come from the same pallet
 * (the one with the latest last_movement_at)
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

async function testLatestPalletDates() {
  try {
    console.log('🧪 Testing Preparation Area Inventory - Latest Pallet Dates\n');

    // Step 1: Find a SKU with multiple pallets in a prep area
    console.log('📋 Step 1: Finding SKU with multiple pallets in prep area...');
    
    const { data: multiPalletSkus, error: searchError } = await supabase
      .from('wms_inventory_balances')
      .select('sku_id, location_id, warehouse_id')
      .in('location_id', ['PK001', 'PK002', 'PK003', 'PK004', 'PK005'])
      .limit(1000);

    if (searchError) {
      console.error('❌ Error searching:', searchError);
      return;
    }

    // Group by SKU+Location to find ones with multiple pallets
    const grouped = {};
    for (const item of multiPalletSkus || []) {
      const key = `${item.sku_id}_${item.location_id}_${item.warehouse_id}`;
      grouped[key] = (grouped[key] || 0) + 1;
    }

    const multiPalletKey = Object.keys(grouped).find(key => grouped[key] > 1);
    
    if (!multiPalletKey) {
      console.log('⚠️ No SKU with multiple pallets found in prep areas');
      console.log('Testing with single pallet SKU instead...\n');
      
      // Use first available SKU
      const testItem = multiPalletSkus[0];
      await testSingleSku(testItem.sku_id, testItem.location_id, testItem.warehouse_id);
      return;
    }

    const [sku_id, location_id, warehouse_id] = multiPalletKey.split('_');
    console.log(`✅ Found SKU with multiple pallets: ${sku_id} at ${location_id}`);
    
    await testSingleSku(sku_id, location_id, warehouse_id);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testSingleSku(sku_id, location_id, warehouse_id) {
  console.log(`\n📦 Testing SKU: ${sku_id} at ${location_id}\n`);

  // Step 2: Get all pallets for this SKU
  console.log('Step 2: Fetching all pallets...');
  const { data: pallets, error: palletError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('sku_id', sku_id)
    .eq('location_id', location_id)
    .eq('warehouse_id', warehouse_id)
    .order('last_movement_at', { ascending: false, nullsFirst: false });

  if (palletError) {
    console.error('❌ Error fetching pallets:', palletError);
    return;
  }

  console.log(`Found ${pallets.length} pallet(s):\n`);
  pallets.forEach((p, idx) => {
    console.log(`  ${idx + 1}. Pallet: ${p.pallet_id_external || p.pallet_id || 'N/A'}`);
    console.log(`     Last Movement: ${p.last_movement_at || 'N/A'}`);
    console.log(`     Production Date: ${p.production_date || 'N/A'}`);
    console.log(`     Expiry Date: ${p.expiry_date || 'N/A'}`);
    console.log(`     Lot No: ${p.lot_no || 'N/A'}`);
    console.log(`     Qty: ${p.total_piece_qty} pieces\n`);
  });

  // Step 3: Get preparation area inventory record
  console.log('Step 3: Fetching preparation area inventory record...');
  const { data: prepInv, error: prepError } = await supabase
    .from('preparation_area_inventory')
    .select('*')
    .eq('sku_id', sku_id)
    .eq('preparation_area_code', location_id)
    .eq('warehouse_id', warehouse_id)
    .single();

  if (prepError) {
    console.error('❌ Error fetching prep area inventory:', prepError);
    return;
  }

  console.log('Preparation Area Inventory Record:');
  console.log(`  Latest Pallet: ${prepInv.latest_pallet_id_external || prepInv.latest_pallet_id || 'N/A'}`);
  console.log(`  Last Movement: ${prepInv.last_movement_at || 'N/A'}`);
  console.log(`  Production Date: ${prepInv.latest_production_date || 'N/A'}`);
  console.log(`  Expiry Date: ${prepInv.latest_expiry_date || 'N/A'}`);
  console.log(`  Lot No: ${prepInv.latest_lot_no || 'N/A'}`);
  console.log(`  Total Qty: ${prepInv.total_piece_qty} pieces\n`);

  // Step 4: Verify consistency
  console.log('Step 4: Verifying consistency...');
  
  const latestPallet = pallets[0]; // First one is latest due to ORDER BY
  
  const checks = {
    pallet_id: prepInv.latest_pallet_id === latestPallet.pallet_id,
    pallet_id_external: prepInv.latest_pallet_id_external === latestPallet.pallet_id_external,
    production_date: prepInv.latest_production_date === latestPallet.production_date,
    expiry_date: prepInv.latest_expiry_date === latestPallet.expiry_date,
    lot_no: prepInv.latest_lot_no === latestPallet.lot_no,
    last_movement_at: prepInv.last_movement_at === latestPallet.last_movement_at
  };

  console.log('\nConsistency Checks:');
  Object.entries(checks).forEach(([field, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${field}: ${passed ? 'MATCH' : 'MISMATCH'}`);
    if (!passed) {
      console.log(`     Expected: ${latestPallet[field]}`);
      console.log(`     Got: ${prepInv['latest_' + field] || prepInv[field]}`);
    }
  });

  const allPassed = Object.values(checks).every(v => v);
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ TEST PASSED: All dates come from the latest pallet');
  } else {
    console.log('❌ TEST FAILED: Dates do not match the latest pallet');
  }
  console.log('='.repeat(60));
}

testLatestPalletDates();
