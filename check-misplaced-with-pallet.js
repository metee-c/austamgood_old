/**
 * Check misplaced items that have actual pallet IDs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMisplacedWithPallet() {
  console.log('=== Checking Misplaced Items WITH Pallet ID ===\n');

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

    const prepAreaCodes = new Set(prepAreas.map(p => p.area_code));
    console.log(`Found ${prepAreaCodes.size} preparation areas\n`);

    // Fetch inventory with pallet_id or pallet_id_external
    const { data: inventory, error: invError } = await supabase
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
        )
      `)
      .not('master_sku.default_location', 'is', null)
      .in('location_id', Array.from(prepAreaCodes));

    if (invError) {
      console.error('Error fetching inventory:', invError);
      return;
    }

    console.log(`Total inventory records in prep areas: ${inventory.length}\n`);

    // Filter for misplaced items
    const misplacedItems = inventory.filter(item => {
      const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
      const currentLocation = item.location_id;
      const designatedHome = masterSku?.default_location;
      const isInPickingHome = prepAreaCodes.has(currentLocation);
      
      // Item is misplaced if it's in a picking home but not the designated one
      return isInPickingHome && currentLocation !== designatedHome;
    });

    console.log(`Total misplaced items: ${misplacedItems.length}\n`);

    // Count items WITH pallet ID
    const withPalletId = misplacedItems.filter(item => 
      item.pallet_id || item.pallet_id_external
    );

    // Count items WITHOUT pallet ID
    const withoutPalletId = misplacedItems.filter(item => 
      !item.pallet_id && !item.pallet_id_external
    );

    console.log('=== SUMMARY ===');
    console.log(`Total misplaced items: ${misplacedItems.length}`);
    console.log(`  - WITH Pallet ID: ${withPalletId.length}`);
    console.log(`  - WITHOUT Pallet ID: ${withoutPalletId.length}`);
    console.log('');

    // Show items WITH pallet ID
    if (withPalletId.length > 0) {
      console.log('=== Items WITH Pallet ID ===\n');
      withPalletId.forEach((item, i) => {
        const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
        console.log(`${i + 1}. Balance ID: ${item.balance_id}`);
        console.log(`   SKU: ${item.sku_id} - ${masterSku?.sku_name}`);
        console.log(`   Pallet: ${item.pallet_id_external || item.pallet_id}`);
        console.log(`   Current: ${item.location_id} → Should be: ${masterSku?.default_location}`);
        console.log(`   Qty: ${item.total_pack_qty} packs, ${item.total_piece_qty} pieces`);
        console.log('');
      });
    }

    // Show first 10 items WITHOUT pallet ID
    if (withoutPalletId.length > 0) {
      console.log('=== First 10 Items WITHOUT Pallet ID ===\n');
      withoutPalletId.slice(0, 10).forEach((item, i) => {
        const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku;
        console.log(`${i + 1}. Balance ID: ${item.balance_id}`);
        console.log(`   SKU: ${item.sku_id} - ${masterSku?.sku_name}`);
        console.log(`   Pallet: NULL`);
        console.log(`   Current: ${item.location_id} → Should be: ${masterSku?.default_location}`);
        console.log(`   Qty: ${item.total_pack_qty} packs, ${item.total_piece_qty} pieces`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkMisplacedWithPallet().catch(console.error);
