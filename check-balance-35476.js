/**
 * Check Balance ID 35476 to understand the issue
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBalance() {
  console.log('=== Checking Balance ID 35476 ===\n');

  // Get balance info
  const { data: balance } = await supabase
    .from('wms_inventory_balances')
    .select(`
      balance_id,
      sku_id,
      location_id,
      pallet_id,
      pallet_id_external,
      total_piece_qty,
      master_sku (
        sku_name,
        default_location
      )
    `)
    .eq('balance_id', 35476)
    .single();

  if (!balance) {
    console.log('Balance not found!');
    return;
  }

  const masterSku = Array.isArray(balance.master_sku) ? balance.master_sku[0] : balance.master_sku;

  console.log('Balance Info:');
  console.log(`  Balance ID: ${balance.balance_id}`);
  console.log(`  SKU: ${balance.sku_id}`);
  console.log(`  Name: ${masterSku?.sku_name}`);
  console.log(`  Current Location: ${balance.location_id}`);
  console.log(`  Default Location (from master_sku): ${masterSku?.default_location}`);
  console.log(`  Pallet: ${balance.pallet_id_external || balance.pallet_id || 'N/A'}`);
  console.log(`  Qty: ${balance.total_piece_qty} pieces`);
  console.log('');

  // Check if current location is a prep area
  const { data: currentPrepArea } = await supabase
    .from('preparation_area')
    .select('area_code, area_name')
    .eq('area_code', balance.location_id)
    .single();

  console.log('Current Location Info:');
  if (currentPrepArea) {
    console.log(`  ${balance.location_id} IS a prep area`);
    console.log(`  Name: ${currentPrepArea.area_name}`);
  } else {
    console.log(`  ${balance.location_id} is NOT a prep area`);
  }
  console.log('');

  // Check if default_location is a prep area
  if (masterSku?.default_location) {
    const { data: defaultPrepArea } = await supabase
      .from('preparation_area')
      .select('area_code, area_name')
      .eq('area_code', masterSku.default_location)
      .single();

    console.log('Default Location Info:');
    if (defaultPrepArea) {
      console.log(`  ${masterSku.default_location} IS a prep area`);
      console.log(`  Name: ${defaultPrepArea.area_name}`);
    } else {
      console.log(`  ${masterSku.default_location} is NOT a prep area`);
    }
    console.log('');
  }

  // Determine if misplaced
  const isInPickingHome = !!currentPrepArea;
  const isMisplaced = isInPickingHome && balance.location_id !== masterSku?.default_location;

  console.log('Analysis:');
  console.log(`  Is in picking home: ${isInPickingHome ? 'YES' : 'NO'}`);
  console.log(`  Is misplaced: ${isMisplaced ? 'YES' : 'NO'}`);
  console.log('');

  if (isMisplaced) {
    console.log('❌ This item IS misplaced');
    console.log(`   Currently at: ${balance.location_id}`);
    console.log(`   Should be at: ${masterSku?.default_location}`);
  } else {
    console.log('✅ This item is NOT misplaced');
    console.log(`   It is correctly at: ${balance.location_id}`);
  }
}

checkBalance().catch(console.error);
