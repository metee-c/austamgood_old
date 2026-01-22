/**
 * Fix Missing Balance Records
 * 
 * Problem: Some pallets have transactions in wms_inventory_ledger but no records in wms_inventory_balances
 * This causes the mobile transfer page to not find these pallets when searching
 * 
 * Root Cause: The trigger trg_sync_inventory_ledger_to_balance may have failed or was not active
 * when these transactions were created
 * 
 * Solution: Manually sync ledger to balance for affected pallets
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findMissingBalances() {
  console.log('🔍 Finding pallets with missing balance records...\n');

  // Get all ledger entries grouped by pallet/sku/location
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('pallet_id, sku_id, location_id, piece_qty');

  if (ledgerError) {
    console.error('❌ Error fetching ledger:', ledgerError);
    return [];
  }

  // Group by pallet/sku/location and calculate totals
  const ledgerMap = new Map();
  ledgerData.forEach(row => {
    const key = `${row.pallet_id}|${row.sku_id}|${row.location_id}`;
    const current = ledgerMap.get(key) || { 
      pallet_id: row.pallet_id, 
      sku_id: row.sku_id, 
      location_id: row.location_id, 
      total_qty: 0 
    };
    current.total_qty += parseFloat(row.piece_qty);
    ledgerMap.set(key, current);
  });

  // Filter only positive balances
  const positiveBalances = Array.from(ledgerMap.values())
    .filter(row => row.total_qty > 0);

  // Get all balance records
  const { data: balanceData, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('pallet_id, sku_id, location_id');

  if (balanceError) {
    console.error('❌ Error fetching balances:', balanceError);
    return [];
  }

  // Create set of existing balances
  const balanceSet = new Set(
    balanceData.map(row => `${row.pallet_id}|${row.sku_id}|${row.location_id}`)
  );

  // Find missing balances
  const missing = positiveBalances.filter(row => {
    const key = `${row.pallet_id}|${row.sku_id}|${row.location_id}`;
    return !balanceSet.has(key);
  });

  console.log(`Found ${missing.length} missing balance records:\n`);
  missing.forEach((row, i) => {
    console.log(`${i + 1}. Pallet: ${row.pallet_id}`);
    console.log(`   SKU: ${row.sku_id}`);
    console.log(`   Location: ${row.location_id}`);
    console.log(`   Qty: ${row.total_qty}`);
    console.log('');
  });

  return missing;
}

async function fixMissingBalance(pallet_id, sku_id, location_id, total_qty) {
  console.log(`📝 Fixing: ${pallet_id} at ${location_id}...`);

  const { data, error } = await supabase
    .from('wms_inventory_balances')
    .insert({
      warehouse_id: 'WH001',
      location_id: location_id,
      sku_id: sku_id,
      pallet_id: pallet_id,
      total_piece_qty: total_qty,
      reserved_piece_qty: 0
    })
    .select();

  if (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }

  console.log(`   ✅ Created balance record (ID: ${data[0].balance_id})`);
  return true;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Fix Missing Balance Records');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Find missing balances
  const missing = await findMissingBalances();

  if (missing.length === 0) {
    console.log('✅ No missing balance records found!');
    return;
  }

  // Ask for confirmation
  console.log(`⚠️  Found ${missing.length} missing balance records`);
  console.log('');
  console.log('This will insert balance records for all missing pallets.');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 2: Fix in batches for better performance
  console.log('🔧 Fixing missing balance records in batches...\n');
  
  const BATCH_SIZE = 50;
  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missing.length / BATCH_SIZE)} (${batch.length} records)...`);

    // Prepare batch insert
    const records = batch.map(row => ({
      warehouse_id: 'WH001',
      location_id: row.location_id,
      sku_id: row.sku_id,
      pallet_id: row.pallet_id,
      total_piece_qty: row.total_qty,
      reserved_piece_qty: 0
    }));

    const { data, error } = await supabase
      .from('wms_inventory_balances')
      .insert(records)
      .select();

    if (error) {
      console.error(`   ❌ Batch error: ${error.message}`);
      failed += batch.length;
    } else {
      console.log(`   ✅ Inserted ${data.length} records`);
      fixed += data.length;
    }

    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  ✅ Fixed: ${fixed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Total: ${missing.length}`);
  console.log('='.repeat(60));

  // Step 3: Verify the fix
  console.log('');
  console.log('🔍 Verifying fix...\n');

  const stillMissing = await findMissingBalances();

  if (stillMissing.length === 0) {
    console.log('✅ All balance records are now in sync!');
  } else {
    console.log(`⚠️  Still ${stillMissing.length} missing balance records`);
    console.log('');
    console.log('Remaining issues (first 10):');
    stillMissing.slice(0, 10).forEach((row, i) => {
      console.log(`${i + 1}. ${row.pallet_id} - ${row.sku_id} @ ${row.location_id}`);
    });
  }
}

main().catch(console.error);
