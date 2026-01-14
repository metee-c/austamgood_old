const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testBfsStagingAPI() {
  console.log('🧪 Testing BFS Staging API Logic...\n');

  // Step 1: Get PQTD and MRTD locations
  const { data: locations } = await supabase
    .from('master_location')
    .select('location_id, location_code')
    .in('location_code', ['PQTD', 'MRTD']);

  console.log('✅ Step 1: Found locations:', locations);
  const locationIds = locations.map(l => l.location_id);

  // Step 2: Get inventory at these locations
  const { data: inventory } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, location_id, total_piece_qty')
    .in('location_id', locationIds)
    .gt('total_piece_qty', 0)
    .limit(5);

  console.log('\n✅ Step 2: Found inventory items:', inventory?.length);
  if (inventory && inventory.length > 0) {
    console.log('Sample:', inventory[0]);
  }

  // Step 3: For first item, get BFS items
  if (inventory && inventory.length > 0) {
    const testItem = inventory[0];
    console.log(`\n✅ Step 3: Testing SKU ${testItem.sku_id}...`);

    const { data: bfsItems, error } = await supabase
      .from('bonus_face_sheet_items')
      .select(`
        id,
        face_sheet_id,
        sku_id,
        quantity_picked,
        quantity_to_pick,
        package_id,
        bonus_face_sheets!face_sheet_id (
          id,
          face_sheet_no,
          status,
          warehouse_id
        ),
        bonus_face_sheet_packages!package_id (
          id,
          package_number,
          barcode_id,
          hub,
          storage_location,
          order_id,
          order_no,
          shop_name,
          province,
          phone
        )
      `)
      .eq('sku_id', testItem.sku_id)
      .limit(10);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`Found ${bfsItems?.length || 0} BFS items for this SKU`);

    // Step 4: Filter items at staging
    const atStaging = bfsItems?.filter(item => {
      const bfs = item.bonus_face_sheets;
      const pkg = item.bonus_face_sheet_packages;
      
      if (!bfs || !pkg) return false;
      if (!['picked', 'completed'].includes(bfs.status)) return false;
      
      const isAtStaging = !pkg.storage_location || pkg.storage_location.trim() === '';
      return isAtStaging;
    });

    console.log(`\n✅ Step 4: Filtered to ${atStaging?.length || 0} items at staging`);
    
    if (atStaging && atStaging.length > 0) {
      console.log('\n📦 Sample BFS item at staging:');
      const sample = atStaging[0];
      console.log({
        bfs_item_id: sample.id,
        face_sheet_no: sample.bonus_face_sheets?.face_sheet_no,
        status: sample.bonus_face_sheets?.status,
        package_number: sample.bonus_face_sheet_packages?.package_number,
        barcode_id: sample.bonus_face_sheet_packages?.barcode_id,
        storage_location: sample.bonus_face_sheet_packages?.storage_location,
        order_no: sample.bonus_face_sheet_packages?.order_no,
        shop_name: sample.bonus_face_sheet_packages?.shop_name,
        quantity_picked: sample.quantity_picked
      });
    }
  }

  console.log('\n✅ Test complete!');
}

testBfsStagingAPI().catch(console.error);
