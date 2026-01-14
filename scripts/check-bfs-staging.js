const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBfsStaging() {
  console.log('🔍 Checking BFS staging inventory...\n');

  // 1. Check PQTD/MRTD locations exist
  const { data: locations } = await supabase
    .from('master_location')
    .select('*')
    .in('location_code', ['PQTD', 'MRTD']);

  console.log('📍 PQTD/MRTD Locations:', locations);

  if (!locations || locations.length === 0) {
    console.log('❌ No PQTD/MRTD locations found!');
    return;
  }

  const locationIds = locations.map(l => l.location_id);

  // 2. Check inventory at these locations
  const { data: inventory } = await supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      master_location!location_id (location_name, location_code),
      master_sku!sku_id (sku_name)
    `)
    .in('location_id', locationIds)
    .gt('total_piece_qty', 0);

  console.log(`\n📦 Inventory at PQTD/MRTD: ${inventory?.length || 0} items`);
  if (inventory && inventory.length > 0) {
    console.log('Sample items:');
    inventory.slice(0, 3).forEach(item => {
      console.log(`  - ${item.sku_id} at ${item.location_id}: ${item.total_piece_qty} pieces`);
    });
  }

  // 3. Check bonus face sheets
  const { data: bfsAll } = await supabase
    .from('bonus_face_sheets')
    .select('*')
    .in('status', ['picked', 'completed']);

  console.log(`\n📋 Total BFS (picked/completed): ${bfsAll?.length || 0}`);

  // 4. Check bonus face sheet packages
  const { data: packages } = await supabase
    .from('bonus_face_sheet_packages')
    .select(`
      *,
      bonus_face_sheets!face_sheet_id (face_sheet_no, status)
    `)
    .is('storage_location', null);

  console.log(`\n📦 BFS Packages at staging (no storage_location): ${packages?.length || 0}`);
  if (packages && packages.length > 0) {
    console.log('Sample packages:');
    packages.slice(0, 5).forEach(pkg => {
      console.log(`  - Package ${pkg.package_number}, Hub: ${pkg.hub}, BFS: ${pkg.bonus_face_sheets?.face_sheet_no}`);
    });
  }

  // 5. Check bonus face sheet items
  if (inventory && inventory.length > 0) {
    const skuIds = [...new Set(inventory.map(i => i.sku_id))];
    console.log(`\n🔍 Checking BFS items for ${skuIds.length} SKUs...`);

    const { data: bfsItems } = await supabase
      .from('bonus_face_sheet_items')
      .select(`
        *,
        bonus_face_sheets!inner (id, face_sheet_no, status),
        bonus_face_sheet_packages!package_id (
          id,
          package_number,
          hub,
          storage_location
        )
      `)
      .in('sku_id', skuIds.slice(0, 10))
      .in('bonus_face_sheets.status', ['picked', 'completed']);

    console.log(`📋 BFS Items for these SKUs: ${bfsItems?.length || 0}`);
    if (bfsItems && bfsItems.length > 0) {
      console.log('Sample BFS items:');
      bfsItems.slice(0, 5).forEach(item => {
        const pkg = item.bonus_face_sheet_packages;
        console.log(`  - SKU: ${item.sku_id}, BFS: ${item.bonus_face_sheets?.face_sheet_no}, Hub: ${pkg?.hub}, Storage: ${pkg?.storage_location || 'NULL'}`);
      });
    }
  }

  // 6. Summary
  console.log('\n📊 Summary:');
  console.log(`  - PQTD/MRTD locations: ${locations.length}`);
  console.log(`  - Inventory items: ${inventory?.length || 0}`);
  console.log(`  - BFS (picked/completed): ${bfsAll?.length || 0}`);
  console.log(`  - BFS packages at staging: ${packages?.length || 0}`);
}

checkBfsStaging()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
