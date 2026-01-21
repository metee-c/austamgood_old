/**
 * Test what the misplaced API actually returns
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAPI() {
  console.log('=== Testing Misplaced API Response ===\n');

  // Simulate the API logic
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code, area_name')
    .eq('status', 'active');

  const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];
  const prepAreaCodesSet = new Set(prepAreaCodes);
  const prepAreaMap = new Map(prepAreas?.map(p => [p.area_code, p.area_name]) || []);

  // Query inventory in preparation areas
  const { data: inventoryData } = await supabase
    .from('wms_inventory_balances')
    .select(`
      balance_id,
      sku_id,
      location_id,
      pallet_id,
      pallet_id_external,
      lot_no,
      production_date,
      expiry_date,
      total_pack_qty,
      total_piece_qty,
      master_sku (
        sku_name,
        default_location
      ),
      master_location (
        location_id,
        location_name
      )
    `)
    .in('location_id', prepAreaCodes)
    .order('updated_at', { ascending: false })
    .limit(10);

  // Filter for misplaced items
  const misplacedItems = (inventoryData || [])
    .filter(item => {
      const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
      const currentLocation = item.location_id;
      const designatedHome = masterSku?.default_location;
      
      if (!designatedHome) return false;
      
      const isInPickingHome = prepAreaCodesSet.has(currentLocation);
      return isInPickingHome && currentLocation !== designatedHome;
    })
    .map(item => {
      const masterLocation = Array.isArray(item.master_location) ? item.master_location[0] : item.master_location;
      const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
      const currentLocation = item.location_id;
      const designatedHome = masterSku?.default_location || '';
      
      let movePriority = 3;
      if (item.total_piece_qty >= 100) movePriority = 1;
      else if (item.total_piece_qty >= 50) movePriority = 2;
      
      return {
        balance_id: item.balance_id,
        sku_id: item.sku_id,
        sku_name: masterSku?.sku_name || null,
        current_location: currentLocation,
        current_location_name: masterLocation?.location_name || currentLocation,
        designated_home: designatedHome,
        designated_home_name: prepAreaMap.get(designatedHome) || designatedHome,
        total_pieces: item.total_piece_qty || 0,
        total_packs: item.total_pack_qty || 0,
        pallet_id: item.pallet_id_external || item.pallet_id,
        lot_no: item.lot_no,
        production_date: item.production_date,
        expiry_date: item.expiry_date,
        move_priority: movePriority
      };
    });

  console.log(`Found ${misplacedItems.length} misplaced items\n`);

  // Show first 5 items
  for (const item of misplacedItems.slice(0, 5)) {
    console.log(`Balance ID: ${item.balance_id}`);
    console.log(`  SKU: ${item.sku_id}`);
    console.log(`  Name: ${item.sku_name}`);
    console.log(`  Current: ${item.current_location} (${item.current_location_name})`);
    console.log(`  Designated: ${item.designated_home} (${item.designated_home_name})`);
    console.log(`  Pallet: ${item.pallet_id || 'N/A'}`);
    console.log(`  Qty: ${item.total_pieces} pieces`);
    console.log('');
  }

  // Look for B-BAP-C|WEP|030 specifically
  const bapItems = misplacedItems.filter(item => item.sku_id === 'B-BAP-C|WEP|030');
  console.log(`\n=== B-BAP-C|WEP|030 Items (${bapItems.length}) ===\n`);
  
  for (const item of bapItems) {
    console.log(`Balance ID: ${item.balance_id}`);
    console.log(`  Current: ${item.current_location}`);
    console.log(`  Designated: ${item.designated_home}`);
    console.log(`  Pallet: ${item.pallet_id || 'N/A'}`);
    console.log('');
  }
}

testAPI().catch(console.error);
