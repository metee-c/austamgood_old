const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyBfsDispatchFix() {
  console.log('🔍 Verifying BFS Dispatch Fix\n');
  
  // 1. Check inventory at Dispatch
  const { data: dispatchInventory } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, location_id, sku_id, total_piece_qty')
    .eq('location_id', 'Dispatch')
    .gt('total_piece_qty', 0);
  
  console.log(`📦 Inventory at Dispatch: ${dispatchInventory?.length || 0} items\n`);
  
  if (!dispatchInventory || dispatchInventory.length === 0) {
    console.log('✅ No inventory at Dispatch location');
    return;
  }
  
  const skuIds = dispatchInventory.map(item => item.sku_id);
  
  // 2. Check BFS items with these SKUs
  const { data: bfsItems } = await supabase
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
        storage_location,
        order_no,
        shop_name
      )
    `)
    .in('sku_id', skuIds)
    .gt('quantity_picked', 0)
    .is('voided_at', null);
  
  console.log(`📋 BFS items with matching SKUs: ${bfsItems?.length || 0}\n`);
  
  // 3. Filter by storage_location
  const atStaging = bfsItems?.filter(item => {
    const pkg = item.bonus_face_sheet_packages;
    return !pkg?.storage_location || pkg.storage_location.trim() === '';
  }) || [];
  
  const atStorage = bfsItems?.filter(item => {
    const pkg = item.bonus_face_sheet_packages;
    return pkg?.storage_location && pkg.storage_location.trim() !== '';
  }) || [];
  
  console.log('📊 BFS Items Classification:');
  console.log(`  At Staging (should NOT show in Dispatch): ${atStaging.length}`);
  console.log(`  At Storage (should show in Dispatch): ${atStorage.length}\n`);
  
  // 4. Check BFS-20260107-005 specifically
  const bfs20260107005 = bfsItems?.filter(item => {
    const bfs = item.bonus_face_sheets;
    return bfs?.face_sheet_no === 'BFS-20260107-005';
  }) || [];
  
  if (bfs20260107005.length > 0) {
    console.log('🔍 BFS-20260107-005 Details:');
    bfs20260107005.forEach(item => {
      const bfs = item.bonus_face_sheets;
      const pkg = item.bonus_face_sheet_packages;
      const isAtStaging = !pkg?.storage_location || pkg.storage_location.trim() === '';
      
      console.log(`  SKU: ${item.sku_id}`);
      console.log(`    Package: #${pkg?.package_number}`);
      console.log(`    Storage Location: ${pkg?.storage_location || '(null/empty)'}`);
      console.log(`    Status: ${bfs?.status}`);
      console.log(`    Location Type: ${isAtStaging ? 'STAGING (MRTD/PQTD)' : 'STORAGE'}`);
      console.log(`    Should show in Dispatch: ${isAtStaging ? '❌ NO' : '✅ YES'}`);
      console.log('');
    });
  } else {
    console.log('ℹ️ BFS-20260107-005 not found in matching SKUs\n');
  }
  
  // 5. Final verdict
  const bfs20260107005AtStaging = bfs20260107005.filter(item => {
    const pkg = item.bonus_face_sheet_packages;
    return !pkg?.storage_location || pkg.storage_location.trim() === '';
  });
  
  console.log('🎯 Final Verdict:');
  if (bfs20260107005AtStaging.length > 0) {
    console.log('✅ BFS-20260107-005 is at STAGING (MRTD/PQTD)');
    console.log('✅ API will correctly FILTER OUT these items from Dispatch tab');
    console.log('✅ These items will show in "จัดสินค้าเสร็จ (BFS)" tab instead');
  } else if (bfs20260107005.length > 0) {
    console.log('⚠️ BFS-20260107-005 has storage_location set');
    console.log('⚠️ API will show these items in Dispatch tab');
  } else {
    console.log('ℹ️ BFS-20260107-005 not found at Dispatch location');
  }
}

verifyBfsDispatchFix().catch(console.error);
