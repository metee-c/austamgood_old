/**
 * Debug script to compare old vs new misplaced inventory logic
 * This will help identify why the count changed from "more" to 14 items
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMisplacedInventory() {
  console.log('=== Debugging Misplaced Inventory Logic ===\n');

  try {
    // Get all preparation areas
    const { data: prepAreas, error: prepError } = await supabase
      .from('preparation_area')
      .select('area_id, area_code, area_name');

    if (prepError) {
      console.error('Error fetching preparation areas:', prepError);
      return;
    }

    const pickingHomeCodes = new Set(prepAreas.map(area => area.area_code));
    console.log(`Found ${pickingHomeCodes.size} picking homes:`, Array.from(pickingHomeCodes).join(', '));
    console.log('');

    // Get ALL inventory (not just in picking homes)
    const { data: allInventory, error: invError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        balance_id,
        sku_id,
        pallet_id,
        pallet_id_external,
        location_id,
        total_piece_qty,
        master_location!location_id (
          location_code,
          location_name
        ),
        master_sku!sku_id (
          sku_id,
          sku_name,
          default_location
        )
      `)
      .gt('total_piece_qty', 0);

    if (invError) {
      console.error('Error fetching inventory:', invError);
      return;
    }

    console.log(`Total inventory records: ${allInventory.length}\n`);

    // Analyze the data
    let skusWithDefaultLocation = 0;
    let skusWithoutDefaultLocation = 0;
    let itemsInPickingHomes = 0;
    let itemsInBulkStorage = 0;
    let misplacedByOldLogic = [];
    let misplacedByNewLogic = [];

    for (const item of allInventory) {
      const currentLocation = item.master_location?.location_code;
      const defaultLocation = item.master_sku?.default_location;
      const skuName = item.master_sku?.sku_name || item.sku_id;
      const isInPickingHome = pickingHomeCodes.has(currentLocation);

      // Count SKUs with/without default_location
      if (defaultLocation) {
        skusWithDefaultLocation++;
      } else {
        skusWithoutDefaultLocation++;
      }

      // Count items in picking homes vs bulk storage
      if (isInPickingHome) {
        itemsInPickingHomes++;
      } else {
        itemsInBulkStorage++;
      }

      // OLD LOGIC (from script): Item is misplaced if in picking home AND has default_location AND they don't match
      if (isInPickingHome && defaultLocation && defaultLocation !== currentLocation) {
        misplacedByOldLogic.push({
          pallet_id: item.pallet_id_external || item.pallet_id,
          sku_id: item.sku_id,
          sku_name: skuName,
          qty: item.total_piece_qty,
          current_location: currentLocation,
          default_location: defaultLocation,
          reason: 'In picking home but wrong location'
        });
      }

      // NEW LOGIC (from API): Same as old logic
      // Item is misplaced if:
      // 1. It's in a picking home
      // 2. The picking home is NOT its designated home
      if (isInPickingHome && currentLocation !== defaultLocation) {
        misplacedByNewLogic.push({
          pallet_id: item.pallet_id_external || item.pallet_id,
          sku_id: item.sku_id,
          sku_name: skuName,
          qty: item.total_piece_qty,
          current_location: currentLocation,
          default_location: defaultLocation,
          reason: 'In picking home but wrong location'
        });
      }
    }

    console.log('=== ANALYSIS ===');
    console.log(`SKUs with default_location: ${skusWithDefaultLocation}`);
    console.log(`SKUs without default_location: ${skusWithoutDefaultLocation}`);
    console.log(`Items in picking homes: ${itemsInPickingHomes}`);
    console.log(`Items in bulk storage: ${itemsInBulkStorage}`);
    console.log('');

    console.log('=== COMPARISON ===');
    console.log(`Old Logic (script): ${misplacedByOldLogic.length} misplaced items`);
    console.log(`New Logic (API): ${misplacedByNewLogic.length} misplaced items`);
    console.log('');

    // The difference is that NEW logic includes items with NULL default_location
    // Let's check if that's the case
    const newLogicWithoutDefault = misplacedByNewLogic.filter(item => !item.default_location);
    console.log(`Items in NEW logic with NULL default_location: ${newLogicWithoutDefault.length}`);
    console.log('');

    if (misplacedByNewLogic.length > 0) {
      console.log('=== MISPLACED ITEMS (NEW LOGIC) ===\n');
      
      // Group by whether they have default_location
      const withDefault = misplacedByNewLogic.filter(item => item.default_location);
      const withoutDefault = misplacedByNewLogic.filter(item => !item.default_location);

      console.log(`With default_location: ${withDefault.length}`);
      withDefault.forEach((item, index) => {
        console.log(`${index + 1}. ${item.sku_id} - ${item.sku_name}`);
        console.log(`   Current: ${item.current_location} → Should be: ${item.default_location}`);
        console.log(`   Qty: ${item.qty} pieces, Pallet: ${item.pallet_id}`);
        console.log('');
      });

      console.log(`\nWithout default_location: ${withoutDefault.length}`);
      withoutDefault.forEach((item, index) => {
        console.log(`${index + 1}. ${item.sku_id} - ${item.sku_name}`);
        console.log(`   Current: ${item.current_location} → default_location: NULL`);
        console.log(`   Qty: ${item.qty} pieces, Pallet: ${item.pallet_id}`);
        console.log('');
      });
    }

    // Check the API query logic
    console.log('=== API QUERY ANALYSIS ===');
    console.log('The API uses: .not("master_sku.default_location", "is", null)');
    console.log('This filters OUT items where default_location is NULL');
    console.log('So the API should only show items WITH a default_location');
    console.log('');

    // Let's verify what the API query would return
    const { data: apiQueryResult, error: apiError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        sku_id,
        location_id,
        total_piece_qty,
        pallet_id,
        master_sku!inner (
          sku_name,
          default_location
        ),
        master_location!inner (
          location_code
        )
      `)
      .not('master_sku.default_location', 'is', null);

    if (apiError) {
      console.error('Error with API query:', apiError);
    } else {
      console.log(`API query returns: ${apiQueryResult.length} records`);
      
      // Filter for misplaced (same logic as API)
      const apiMisplaced = apiQueryResult.filter(item => {
        const masterLocation = Array.isArray(item.master_location) ? item.master_location[0] : item.master_location;
        const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
        
        const currentLocation = masterLocation?.location_code;
        const designatedHome = masterSku?.default_location;
        const isInPickingHome = pickingHomeCodes.has(currentLocation);
        
        return isInPickingHome && currentLocation !== designatedHome;
      });

      console.log(`API logic finds: ${apiMisplaced.length} misplaced items`);
      console.log('');

      if (apiMisplaced.length > 0) {
        console.log('First 5 misplaced items from API logic:');
        apiMisplaced.slice(0, 5).forEach((item, index) => {
          const masterLocation = Array.isArray(item.master_location) ? item.master_location[0] : item.master_location;
          const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
          
          console.log(`${index + 1}. ${item.sku_id} - ${masterSku?.sku_name}`);
          console.log(`   Current: ${masterLocation?.location_code} → Should be: ${masterSku?.default_location}`);
          console.log(`   Qty: ${item.total_piece_qty}, Pallet: ${item.pallet_id}`);
          console.log('');
        });
      }
    }

    // Save detailed report
    const fs = require('fs');
    fs.writeFileSync(
      'misplaced-inventory-debug.json',
      JSON.stringify({
        summary: {
          total_inventory: allInventory.length,
          skus_with_default_location: skusWithDefaultLocation,
          skus_without_default_location: skusWithoutDefaultLocation,
          items_in_picking_homes: itemsInPickingHomes,
          items_in_bulk_storage: itemsInBulkStorage,
          misplaced_old_logic: misplacedByOldLogic.length,
          misplaced_new_logic: misplacedByNewLogic.length,
          api_query_result: apiQueryResult?.length || 0,
          generated_at: new Date().toISOString()
        },
        misplaced_old_logic: misplacedByOldLogic,
        misplaced_new_logic: misplacedByNewLogic,
        picking_homes: Array.from(pickingHomeCodes)
      }, null, 2)
    );
    console.log('✓ Debug report saved to: misplaced-inventory-debug.json');

  } catch (error) {
    console.error('Error:', error);
  }
}

debugMisplacedInventory().catch(console.error);
