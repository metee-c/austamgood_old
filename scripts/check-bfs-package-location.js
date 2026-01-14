const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBfsPackageLocation() {
  console.log('🔍 Checking BFS-20260107-005 stock location and package storage_location...\n');
  
  // 1. Check inventory balance location
  const { data: inventory, error: invError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, location_id, sku_id, total_piece_qty')
    .in('sku_id', ['B-BAP-C|KNP|030', 'B-BEY-D|CNL|012'])
    .gt('total_piece_qty', 0);
  
  if (invError) {
    console.error('❌ Error fetching inventory:', invError);
    return;
  }
  
  console.log('📦 Inventory Balance:');
  inventory?.forEach(item => {
    console.log(`  SKU: ${item.sku_id} | ${item.total_piece_qty} pieces at ${item.location_id}`);
  });
  
  // 2. Check bonus_face_sheet_items with packages
  const { data: items, error: itemsError } = await supabase
    .from('bonus_face_sheet_items')
    .select(`
      sku_id,
      quantity_picked,
      package_id,
      bonus_face_sheets!face_sheet_id (
        face_sheet_no,
        status
      ),
      bonus_face_sheet_packages!package_id (
        package_number,
        barcode_id,
        order_no,
        shop_name,
        hub,
        storage_location
      )
    `)
    .in('sku_id', ['B-BAP-C|KNP|030', 'B-BEY-D|CNL|012'])
    .gt('quantity_picked', 0);
  
  if (itemsError) {
    console.error('❌ Error fetching BFS items:', itemsError);
    return;
  }
  
  console.log('\n📋 BFS Items:');
  items?.forEach(item => {
    const bfs = item.bonus_face_sheets;
    const pkg = item.bonus_face_sheet_packages;
    console.log(`  SKU: ${item.sku_id}`);
    console.log(`    BFS: ${bfs?.face_sheet_no} (status: ${bfs?.status})`);
    console.log(`    Package: #${pkg?.package_number} | Hub: ${pkg?.hub}`);
    console.log(`    Storage Location: ${pkg?.storage_location || '(null/empty = at staging)'}`);
    console.log('');
  });
  
  // 3. Summary
  console.log('\n📊 Summary:');
  const atStaging = items?.filter(item => !item.bonus_face_sheet_packages?.storage_location);
  const atStorage = items?.filter(item => item.bonus_face_sheet_packages?.storage_location);
  console.log(`  At Staging (MRTD/PQTD): ${atStaging?.length || 0} items`);
  console.log(`  At Storage Location: ${atStorage?.length || 0} items`);
}

checkBfsPackageLocation().catch(console.error);
