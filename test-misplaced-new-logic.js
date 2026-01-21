/**
 * Test misplaced inventory with NEW query logic (matching updated API)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testNewLogic() {
  console.log('=== Testing NEW Misplaced Inventory Query Logic ===\n');

  try {
    // Get all preparation areas first
    const { data: prepAreas } = await supabase
      .from('preparation_area')
      .select('area_code, area_name')
      .eq('status', 'active');

    const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];
    const prepAreaMap = new Map(prepAreas?.map(p => [p.area_code, p.area_name]) || []);

    console.log(`Found ${prepAreaCodes.length} preparation areas\n`);

    // Query inventory in preparation areas only (NEW LOGIC)
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
      .order('updated_at', { ascending: false });

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return;
    }

    console.log(`Total inventory records in prep areas: ${inventoryData.length}\n`);

    // Filter for misplaced items
    const misplacedItems = (inventoryData || [])
      .filter(item => {
        const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
        
        const currentLocation = item.location_id;
        const designatedHome = masterSku?.default_location;
        
        // Skip items without default_location
        if (!designatedHome) return false;
        
        const isInPickingHome = prepAreaCodes.includes(currentLocation);
        
        // Item is misplaced if it's in a picking home but not the designated one
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

    // Show first 10 items
    if (misplacedItems.length > 0) {
      console.log('=== First 10 Misplaced Items ===\n');
      misplacedItems.slice(0, 10).forEach((item, i) => {
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

    // Compare with script results
    console.log('\n=== COMPARISON ===');
    console.log('Script found: 114 misplaced sub-items across 52 SKUs');
    console.log(`API now finds: ${misplacedItems.length} misplaced items across ${uniqueSkus.size} SKUs`);
    console.log('');
    
    if (misplacedItems.length === 114) {
      console.log('✅ SUCCESS! API now returns all 114 misplaced items!');
    } else {
      console.log(`⚠️  Still a difference. Expected 114, got ${misplacedItems.length}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testNewLogic().catch(console.error);
