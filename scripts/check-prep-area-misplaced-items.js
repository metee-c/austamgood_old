/**
 * Script to check misplaced items in preparation area inventory page
 * This checks items in sub-rows (expandable rows) to see how many are misplaced
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPrepAreaMisplacedItems() {
  console.log('=== Checking Misplaced Items in Preparation Area Inventory ===\n');

  try {
    // Get all preparation areas
    const { data: prepAreas, error: prepError } = await supabase
      .from('preparation_area')
      .select('area_code, area_name')
      .eq('status', 'active');

    if (prepError) {
      console.error('Error fetching preparation areas:', prepError);
      return;
    }

    const prepAreaCodes = prepAreas.map(p => p.area_code);
    console.log(`Found ${prepAreaCodes.length} preparation areas\n`);

    // Fetch inventory in preparation areas (same as the page does)
    const { data: inventory, error: invError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_location!location_id (
          location_name
        ),
        master_warehouse!warehouse_id (
          warehouse_name
        ),
        master_sku!sku_id (
          sku_name,
          default_location,
          weight_per_piece_kg
        )
      `)
      .in('location_id', prepAreaCodes)
      .order('updated_at', { ascending: false })
      .limit(2000);

    if (invError) {
      console.error('Error fetching inventory:', invError);
      return;
    }

    console.log(`Total inventory records in prep areas: ${inventory.length}\n`);

    // Aggregate by SKU (same as the page does)
    const skuMap = new Map();
    for (const item of inventory) {
      const existing = skuMap.get(item.sku_id);
      if (existing) {
        existing.total_piece_qty += item.total_piece_qty || 0;
        existing.total_pack_qty += item.total_pack_qty || 0;
        existing.reserved_piece_qty += item.reserved_piece_qty || 0;
        existing.reserved_pack_qty += item.reserved_pack_qty || 0;
        existing.subItems.push(item);
      } else {
        skuMap.set(item.sku_id, {
          sku_id: item.sku_id,
          sku_name: item.master_sku?.sku_name,
          default_location: item.master_sku?.default_location,
          total_piece_qty: item.total_piece_qty || 0,
          total_pack_qty: item.total_pack_qty || 0,
          reserved_piece_qty: item.reserved_piece_qty || 0,
          reserved_pack_qty: item.reserved_pack_qty || 0,
          subItems: [item]
        });
      }
    }

    console.log(`Aggregated into ${skuMap.size} unique SKUs\n`);

    // Check each SKU's sub-items for misplaced items
    let totalMisplaced = 0;
    let skusWithMisplaced = 0;
    const misplacedDetails = [];

    for (const [skuId, skuData] of skuMap.entries()) {
      const defaultLocation = skuData.default_location;
      
      if (!defaultLocation) {
        // Skip SKUs without default_location
        continue;
      }

      // Check each sub-item
      let misplacedInThisSku = 0;
      const misplacedSubItems = [];

      for (const subItem of skuData.subItems) {
        const currentLocation = subItem.location_id;
        const isInPickingHome = prepAreaCodes.includes(currentLocation);

        // Item is misplaced if it's in a picking home but not the designated one
        if (isInPickingHome && currentLocation !== defaultLocation) {
          misplacedInThisSku++;
          totalMisplaced++;
          misplacedSubItems.push({
            location_id: currentLocation,
            pallet_id: subItem.pallet_id_external || subItem.pallet_id,
            qty: subItem.total_piece_qty,
            lot_no: subItem.lot_no
          });
        }
      }

      if (misplacedInThisSku > 0) {
        skusWithMisplaced++;
        misplacedDetails.push({
          sku_id: skuId,
          sku_name: skuData.sku_name,
          default_location: defaultLocation,
          total_sub_items: skuData.subItems.length,
          misplaced_count: misplacedInThisSku,
          misplaced_items: misplacedSubItems
        });
      }
    }

    console.log('=== SUMMARY ===');
    console.log(`Total SKUs: ${skuMap.size}`);
    console.log(`SKUs with misplaced items: ${skusWithMisplaced}`);
    console.log(`Total misplaced sub-items: ${totalMisplaced}`);
    console.log('');

    if (misplacedDetails.length > 0) {
      console.log('=== MISPLACED ITEMS BY SKU ===\n');

      // Sort by misplaced count (descending)
      misplacedDetails.sort((a, b) => b.misplaced_count - a.misplaced_count);

      for (const detail of misplacedDetails) {
        console.log(`SKU: ${detail.sku_id} - ${detail.sku_name}`);
        console.log(`  Default Location: ${detail.default_location}`);
        console.log(`  Total Sub-Items: ${detail.total_sub_items}`);
        console.log(`  Misplaced: ${detail.misplaced_count} items`);
        console.log('  Details:');
        
        for (const item of detail.misplaced_items) {
          console.log(`    - Location: ${item.location_id} (should be ${detail.default_location})`);
          console.log(`      Pallet: ${item.pallet_id || 'N/A'}, Qty: ${item.qty}, Lot: ${item.lot_no || 'N/A'}`);
        }
        console.log('');
      }

      // Save to JSON
      const fs = require('fs');
      fs.writeFileSync(
        'prep-area-misplaced-items.json',
        JSON.stringify({
          summary: {
            total_skus: skuMap.size,
            skus_with_misplaced: skusWithMisplaced,
            total_misplaced_items: totalMisplaced,
            generated_at: new Date().toISOString()
          },
          misplaced_by_sku: misplacedDetails
        }, null, 2)
      );
      console.log('✓ Report saved to: prep-area-misplaced-items.json');
    } else {
      console.log('✓ No misplaced items found in preparation area inventory!');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkPrepAreaMisplacedItems().catch(console.error);
