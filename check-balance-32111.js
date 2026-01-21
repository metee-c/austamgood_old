/**
 * Check Balance ID 32111 from the screenshot
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBalance() {
  console.log('=== Checking Balance ID 32111 ===\n');

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
      ),
      master_location (
        location_code,
        location_name
      )
    `)
    .eq('balance_id', 32111)
    .single();

  if (!balance) {
    console.log('Balance not found!');
    return;
  }

  const masterSku = Array.isArray(balance.master_sku) ? balance.master_sku[0] : balance.master_sku;
  const masterLocation = Array.isArray(balance.master_location) ? balance.master_location[0] : balance.master_location;

  console.log('✅ Balance Info:');
  console.log(`  Balance ID: ${balance.balance_id}`);
  console.log(`  SKU: ${balance.sku_id}`);
  console.log(`  Name: ${masterSku?.sku_name}`);
  console.log(`  Pallet: ${balance.pallet_id_external || balance.pallet_id || 'N/A'}`);
  console.log(`  Qty: ${balance.total_piece_qty} pieces`);
  console.log('');

  console.log('📍 Location Info:');
  console.log(`  Current Location (location_id): ${balance.location_id}`);
  console.log(`  Current Location Name: ${masterLocation?.location_name || 'N/A'}`);
  console.log(`  Default Location (from master_sku): ${masterSku?.default_location || 'N/A'}`);
  console.log('');

  // Check if locations are prep areas
  const { data: currentPrep } = await supabase
    .from('preparation_area')
    .select('area_code, area_name')
    .eq('area_code', balance.location_id)
    .single();

  const { data: defaultPrep } = await supabase
    .from('preparation_area')
    .select('area_code, area_name')
    .eq('area_code', masterSku?.default_location)
    .single();

  console.log('🏠 Prep Area Check:');
  console.log(`  ${balance.location_id} is prep area: ${currentPrep ? 'YES' : 'NO'}`);
  if (currentPrep) console.log(`    Name: ${currentPrep.area_name}`);
  console.log(`  ${masterSku?.default_location} is prep area: ${defaultPrep ? 'YES' : 'NO'}`);
  if (defaultPrep) console.log(`    Name: ${defaultPrep.area_name}`);
  console.log('');

  // Determine if misplaced
  const isMisplaced = currentPrep && balance.location_id !== masterSku?.default_location;

  console.log('📊 Analysis:');
  console.log(`  Is Misplaced: ${isMisplaced ? '❌ YES' : '✅ NO'}`);
  if (isMisplaced) {
    console.log(`  Currently at: ${balance.location_id} (WRONG)`);
    console.log(`  Should be at: ${masterSku?.default_location} (CORRECT)`);
    console.log(`  Action: Move from ${balance.location_id} → ${masterSku?.default_location}`);
  }
  console.log('');

  // What the report should show
  console.log('📋 Report Should Show:');
  console.log(`  ตำแหน่งปัจจุบัน (สีแดง): ${balance.location_id}`);
  console.log(`  บ้านหยิบที่ถูกต้อง (สีเขียว): ${masterSku?.default_location}`);
  console.log(`  ปุ่มย้าย: จาก ${balance.location_id} → ${masterSku?.default_location}`);
}

checkBalance().catch(console.error);
