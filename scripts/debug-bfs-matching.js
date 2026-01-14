const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugBfsMatching() {
  console.log('🔍 Debugging BFS matching issue...\n');

  // 1. Get inventory SKUs at PQTD/MRTD
  const { data: inventory } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, location_id, total_piece_qty')
    .in('location_id', ['PQTD', 'MRTD'])
    .gt('total_piece_qty', 0);

  const inventorySkus = [...new Set(inventory.map(i => i.sku_id))];
  console.log(`📦 Inventory SKUs at PQTD/MRTD: ${inventorySkus.length}`);
  console.log('Sample SKUs:', inventorySkus.slice(0, 5));

  // 2. Get BFS items SKUs
  const { data: bfsItems } = await supabase
    .from('bonus_face_sheet_items')
    .select(`
      sku_id,
      bonus_face_sheets!inner (status)
    `)
    .in('bonus_face_sheets.status', ['picked', 'completed']);

  const bfsSkus = [...new Set(bfsItems.map(i => i.sku_id))];
  console.log(`\n📋 BFS Items SKUs: ${bfsSkus.length}`);
  console.log('Sample SKUs:', bfsSkus.slice(0, 5));

  // 3. Find matching SKUs
  const matchingSkus = inventorySkus.filter(sku => bfsSkus.includes(sku));
  console.log(`\n✅ Matching SKUs: ${matchingSkus.length}`);
  console.log('Matching SKUs:', matchingSkus);

  // 4. For matching SKUs, check BFS items details
  if (matchingSkus.length > 0) {
    console.log('\n🔍 Checking BFS items for matching SKUs...');
    
    const { data: matchingBfsItems } = await supabase
      .from('bonus_face_sheet_items')
      .select(`
        *,
        bonus_face_sheets!inner (
          id,
          face_sheet_no,
          status
        ),
        bonus_face_sheet_packages!package_id (
          id,
          package_number,
          hub,
          storage_location
        )
      `)
      .in('sku_id', matchingSkus.slice(0, 5))
      .in('bonus_face_sheets.status', ['picked', 'completed']);

    console.log(`Found ${matchingBfsItems?.length || 0} BFS items for matching SKUs`);
    
    if (matchingBfsItems && matchingBfsItems.length > 0) {
      matchingBfsItems.slice(0, 3).forEach(item => {
        const pkg = item.bonus_face_sheet_packages;
        console.log(`\n  SKU: ${item.sku_id}`);
        console.log(`  BFS: ${item.bonus_face_sheets?.face_sheet_no}`);
        console.log(`  Status: ${item.bonus_face_sheets?.status}`);
        console.log(`  Package: ${pkg?.package_number}`);
        console.log(`  Hub: ${pkg?.hub}`);
        console.log(`  Storage Location: ${pkg?.storage_location || 'NULL (at staging)'}`);
      });
    }
  }

  // 5. Check if there are BFS items at staging (no storage_location)
  console.log('\n🔍 Checking BFS packages at staging...');
  const { data: stagingPackages } = await supabase
    .from('bonus_face_sheet_packages')
    .select(`
      *,
      bonus_face_sheets!face_sheet_id (
        face_sheet_no,
        status
      )
    `)
    .is('storage_location', null)
    .in('bonus_face_sheets.status', ['picked', 'completed']);

  console.log(`Found ${stagingPackages?.length || 0} packages at staging`);
  
  if (stagingPackages && stagingPackages.length > 0) {
    // Get SKUs for these packages
    const packageIds = stagingPackages.map(p => p.id);
    const { data: stagingItems } = await supabase
      .from('bonus_face_sheet_items')
      .select('sku_id, package_id')
      .in('package_id', packageIds.slice(0, 10));

    const stagingSkus = [...new Set(stagingItems?.map(i => i.sku_id) || [])];
    console.log(`SKUs in staging packages: ${stagingSkus.length}`);
    console.log('Sample staging SKUs:', stagingSkus.slice(0, 5));

    // Check if any staging SKUs match inventory SKUs
    const stagingMatches = stagingSkus.filter(sku => inventorySkus.includes(sku));
    console.log(`\n✅ Staging SKUs that match inventory: ${stagingMatches.length}`);
    console.log('Matching staging SKUs:', stagingMatches);
  }

  // 6. Summary
  console.log('\n📊 Summary:');
  console.log(`  - Inventory SKUs at PQTD/MRTD: ${inventorySkus.length}`);
  console.log(`  - BFS Items SKUs: ${bfsSkus.length}`);
  console.log(`  - Matching SKUs: ${matchingSkus.length}`);
  console.log(`  - Packages at staging: ${stagingPackages?.length || 0}`);
}

debugBfsMatching()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
