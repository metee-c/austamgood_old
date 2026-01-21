/**
 * Check what the misplaced report is actually showing
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkReport() {
  console.log('=== Checking Misplaced Report Logic ===\n');

  // Get all preparation areas
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code, area_name')
    .eq('status', 'active');

  const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];
  const prepAreaCodesSet = new Set(prepAreaCodes);
  const prepAreaMap = new Map(prepAreas?.map(p => [p.area_code, p.area_name]) || []);

  console.log(`Found ${prepAreaCodes.length} prep areas\n`);

  // Query inventory in preparation areas only
  const { data: inventoryData } = await supabase
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
    .in('location_id', prepAreaCodes)
    .eq('sku_id', 'B-BAP-C|WEP|030')
    .order('balance_id');

  console.log(`Found ${inventoryData?.length || 0} inventory records for B-BAP-C|WEP|030 in prep areas:\n`);

  for (const item of inventoryData || []) {
    const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
    const currentLocation = item.location_id;
    const designatedHome = masterSku?.default_location;
    
    const isInPickingHome = prepAreaCodesSet.has(currentLocation);
    const isMisplaced = isInPickingHome && currentLocation !== designatedHome;

    console.log(`Balance ID: ${item.balance_id}`);
    console.log(`  Current Location: ${currentLocation} (${prepAreaMap.get(currentLocation) || 'N/A'})`);
    console.log(`  Designated Home: ${designatedHome}`);
    console.log(`  Pallet: ${item.pallet_id_external || item.pallet_id || 'N/A'}`);
    console.log(`  Qty: ${item.total_piece_qty} pieces`);
    console.log(`  Is Misplaced: ${isMisplaced ? 'YES' : 'NO'}`);
    console.log('');
  }

  // Check if there are any items at A09-01-010
  const { data: a09Items } = await supabase
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
    .eq('location_id', 'A09-01-010')
    .gt('total_piece_qty', 0);

  console.log(`\n=== Items at A09-01-010 ===\n`);
  console.log(`Found ${a09Items?.length || 0} items:\n`);

  for (const item of a09Items || []) {
    const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
    console.log(`Balance ID: ${item.balance_id}`);
    console.log(`  SKU: ${item.sku_id}`);
    console.log(`  Name: ${masterSku?.sku_name || 'N/A'}`);
    console.log(`  Designated Home: ${masterSku?.default_location || 'N/A'}`);
    console.log(`  Pallet: ${item.pallet_id_external || item.pallet_id || 'N/A'}`);
    console.log(`  Qty: ${item.total_piece_qty} pieces`);
    console.log(`  Is Misplaced: ${masterSku?.default_location !== 'A09-01-010' ? 'YES' : 'NO'}`);
    console.log('');
  }
}

checkReport().catch(console.error);
