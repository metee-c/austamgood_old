/**
 * Script to find misplaced inventory in picking homes
 * Identifies pallets that are in the wrong picking home based on master_sku.default_location
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findMisplacedInventory() {
  console.log('=== Finding Misplaced Inventory in Picking Homes ===\n');

  try {
    // Step 1: Get all preparation areas (picking homes)
    const { data: prepAreas, error: prepError } = await supabase
      .from('preparation_area')
      .select('area_id, area_code, area_name');

    if (prepError) {
      console.error('Error fetching preparation areas:', prepError);
      return;
    }

    const pickingHomeCodes = prepAreas.map(area => area.area_code);
    console.log(`Found ${pickingHomeCodes.length} picking homes:`, pickingHomeCodes.join(', '));
    console.log('');

    // Step 2: Get all inventory in picking homes
    const { data: inventory, error: invError } = await supabase
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
      .in('master_location.location_code', pickingHomeCodes)
      .gt('total_piece_qty', 0);

    if (invError) {
      console.error('Error fetching inventory:', invError);
      return;
    }

    console.log(`Found ${inventory.length} pallets in picking homes\n`);

    // Step 3: Find misplaced items
    const misplaced = [];
    const correct = [];

    for (const item of inventory) {
      const currentLocation = item.master_location?.location_code;
      const correctLocation = item.master_sku?.default_location;
      const skuName = item.master_sku?.sku_name || item.sku_id;

      if (correctLocation && correctLocation !== currentLocation) {
        // Misplaced!
        misplaced.push({
          pallet_id: item.pallet_id_external || item.pallet_id,
          sku_id: item.sku_id,
          sku_name: skuName,
          qty: item.total_piece_qty,
          current_location: currentLocation,
          correct_location: correctLocation,
          location_id: item.location_id
        });
      } else if (correctLocation && correctLocation === currentLocation) {
        // Correct placement
        correct.push(item);
      }
      // If no default_location, we don't count it as misplaced
    }

    // Step 4: Display results
    console.log('=== SUMMARY ===');
    console.log(`✓ Correctly placed: ${correct.length} pallets`);
    console.log(`❌ Misplaced: ${misplaced.length} pallets`);
    console.log('');

    if (misplaced.length > 0) {
      console.log('=== MISPLACED INVENTORY DETAILS ===\n');

      // Group by current location
      const byLocation = {};
      misplaced.forEach(item => {
        if (!byLocation[item.current_location]) {
          byLocation[item.current_location] = [];
        }
        byLocation[item.current_location].push(item);
      });

      for (const [location, items] of Object.entries(byLocation)) {
        console.log(`📍 Current Location: ${location} (${items.length} pallets)`);
        console.log('─'.repeat(80));
        
        items.forEach((item, index) => {
          console.log(`${index + 1}. Pallet: ${item.pallet_id}`);
          console.log(`   SKU: ${item.sku_id} - ${item.sku_name}`);
          console.log(`   Qty: ${item.qty} pieces`);
          console.log(`   ✓ Should be at: ${item.correct_location}`);
          console.log('');
        });
      }

      // Export to JSON for further processing
      const fs = require('fs');
      fs.writeFileSync(
        'misplaced-inventory-report.json',
        JSON.stringify({ 
          summary: {
            total_misplaced: misplaced.length,
            total_correct: correct.length,
            generated_at: new Date().toISOString()
          },
          misplaced_items: misplaced 
        }, null, 2)
      );
      console.log('✓ Report saved to: misplaced-inventory-report.json');
      console.log('');

      // Suggest actions
      console.log('=== RECOMMENDED ACTIONS ===');
      console.log('1. Review the misplaced items above');
      console.log('2. Create replenishment tasks to move pallets to correct locations');
      console.log('3. Use the mobile transfer page to execute the moves');
      console.log('4. The new validation will prevent future misplacements');
      console.log('');
      console.log('To create replenishment tasks automatically, run:');
      console.log('  node scripts/create-replenishment-tasks-for-misplaced.js');
    } else {
      console.log('✓ No misplaced inventory found! All pallets are in correct locations.');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

findMisplacedInventory().catch(console.error);
