/**
 * Check inventory for B-BAP-C|WEP|030 to understand the misplaced report
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkInventory() {
  console.log('=== Checking Inventory for B-BAP-C|WEP|030 ===\n');

  // Get SKU info
  const { data: sku } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, default_location')
    .eq('sku_id', 'B-BAP-C|WEP|030')
    .single();

  console.log('SKU Info:');
  console.log(`  SKU: ${sku.sku_id}`);
  console.log(`  Name: ${sku.sku_name}`);
  console.log(`  Default Location: ${sku.default_location}`);
  console.log('');

  // Get all inventory for this SKU
  const { data: inventory, error } = await supabase
    .from('wms_inventory_balances')
    .select(`
      balance_id,
      location_id,
      pallet_id,
      pallet_id_external,
      total_piece_qty,
      total_pack_qty
    `)
    .eq('sku_id', 'B-BAP-C|WEP|030')
    .gt('total_piece_qty', 0)
    .order('location_id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${inventory.length} inventory records:\n`);
  
  for (const item of inventory) {
    console.log(`Balance ID: ${item.balance_id}`);
    console.log(`  Location: ${item.location_id}`);
    console.log(`  Pallet: ${item.pallet_id_external || item.pallet_id || 'N/A'}`);
    console.log(`  Qty: ${item.total_piece_qty} pieces (${item.total_pack_qty} packs)`);
    console.log(`  Is Misplaced: ${item.location_id !== sku.default_location ? 'YES' : 'NO'}`);
    console.log('');
  }

  // Check if A09-01-010 is a prep area
  const { data: prepArea } = await supabase
    .from('preparation_area')
    .select('area_code, area_name')
    .eq('area_code', 'A09-01-010')
    .single();

  console.log('A09-01-010 Info:');
  if (prepArea) {
    console.log(`  Is Prep Area: YES`);
    console.log(`  Name: ${prepArea.area_name}`);
  } else {
    console.log(`  Is Prep Area: NO`);
  }
  console.log('');

  // Check if PK001 is a prep area
  const { data: pk001 } = await supabase
    .from('preparation_area')
    .select('area_code, area_name')
    .eq('area_code', 'PK001')
    .single();

  console.log('PK001 Info:');
  if (pk001) {
    console.log(`  Is Prep Area: YES`);
    console.log(`  Name: ${pk001.area_name}`);
  } else {
    console.log(`  Is Prep Area: NO`);
  }
}

checkInventory().catch(console.error);
