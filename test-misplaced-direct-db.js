/**
 * Test misplaced inventory query directly against database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMisplacedQuery() {
  console.log('=== Testing Misplaced Inventory Query ===\n');

  try {
    // Query to find misplaced inventory - get ALL balance fields
    const { data: inventoryData, error: inventoryError } = await supabase
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
        master_sku!inner (
          sku_name,
          default_location
        ),
        master_location!inner (
          location_id,
          location_name
        )
      `)
      .not('master_sku.default_location', 'is', null);

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return;
    }

    console.log(`Total inventory records with default_location: ${inventoryData.length}\n`);

    // Get all preparation areas to check if location is a picking home
    const { data: prepAreas } = await supabase
      .from('preparation_area')
      .select('area_code, area_name');

    const prepAreaCodes = new Set(prepAreas?.map(p => p.area_code) || []);
    const prepAreaMap = new Map(prepAreas?.map(p => [p.area_code, p.area_name]) || []);

    console.log(`Found ${prepAreaCodes.size} preparation areas\n`);

    // Filter for misplaced items (in picking homes but wrong location)
    const misplacedItems = (inventoryData || [])
      .filter(item => {
        // Handle both array and object responses from Supabase
        const masterLocation = Array.isArray(item.master_location) ? item.master_location[0] : item.master_location;
        const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
        
        const currentLocation = item.location_id; // Use location_id directly from balance
        const designatedHome = masterSku?.default_location;
        const isInPickingHome = prepAreaCodes.has(currentLocation);
        
        // Item is misplaced if:
        // 1. It's in a picking home
        // 2. The picking home is NOT its designated home
        return isInPickingHome && currentLocation !== designatedHome;
      });

    console.log('=== RESULTS ===');
    console.log(`Total misplaced items: ${misplacedItems.length}\n`);

    // Count items with and without pallet_id
    const withPallet = misplacedItems.filter(item => item.pallet_id || item.pallet_id_external).length;
    const withoutPallet = misplacedItems.filter(item => !item.pallet_id && !item.pallet_id_external).length;

    console.log('=== Pallet ID Breakdown ===');
    console.log(`Items WITH Pallet ID: ${withPallet}`);
    console.log(`Items WITHOUT Pallet ID: ${withoutPallet}`);
    console.log(`Total: ${misplacedItems.length}\n`);

    // Show first 5 items
    if (misplacedItems.length > 0) {
      console.log('=== First 5 Misplaced Items ===\n');
      misplacedItems.slice(0, 5).forEach((item, i) => {
        const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
        const masterLocation = Array.isArray(item.master_location) ? item.master_location[0] : item.master_location;
        
        console.log(`${i+1}. Balance ID: ${item.balance_id}`);
        console.log(`   SKU: ${item.sku_id} - ${masterSku?.sku_name}`);
        console.log(`   Pallet: ${item.pallet_id_external || item.pallet_id || 'NULL'}`);
        console.log(`   Current: ${item.location_id} (${masterLocation?.location_name || 'N/A'})`);
        console.log(`   Should be: ${masterSku?.default_location} (${prepAreaMap.get(masterSku?.default_location) || 'N/A'})`);
        console.log(`   Qty: ${item.total_pack_qty || 0} packs, ${item.total_piece_qty || 0} pieces`);
        console.log('');
      });
    }

    // Show unique SKUs
    const uniqueSkus = new Set(misplacedItems.map(item => item.sku_id));
    console.log(`=== Unique SKUs: ${uniqueSkus.size} ===`);

  } catch (error) {
    console.error('Error:', error);
  }
}

testMisplacedQuery().catch(console.error);
