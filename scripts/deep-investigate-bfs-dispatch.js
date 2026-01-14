const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deepInvestigate() {
  console.log('🔍 Deep Investigation: Why BFS-20260107-005 shows in Dispatch tab\n');
  
  // 1. Check if there's ANY stock at Dispatch for these SKUs
  const { data: dispatchStock } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('location_id', 'Dispatch')
    .in('sku_id', ['B-BAP-C|KNP|030', 'B-BEY-D|CNL|012']);
  
  console.log('📦 Stock at Dispatch location:');
  if (dispatchStock && dispatchStock.length > 0) {
    console.log('❌ FOUND stock at Dispatch (this is the problem!):');
    dispatchStock.forEach(item => {
      console.log(`  - ${item.sku_id}: ${item.total_piece_qty} pieces`);
      console.log(`    Balance ID: ${item.balance_id}`);
      console.log(`    Pallet: ${item.pallet_id || '(none)'}`);
      console.log(`    Created: ${item.created_at}`);
      console.log(`    Updated: ${item.updated_at}`);
    });
  } else {
    console.log('✅ No stock at Dispatch (correct)');
  }
  
  // 2. Get BFS face sheet ID first
  const { data: bfsFaceSheet } = await supabase
    .from('bonus_face_sheets')
    .select('id, face_sheet_no, status')
    .eq('face_sheet_no', 'BFS-20260107-005')
    .single();
  
  if (!bfsFaceSheet) {
    console.log('\n❌ BFS-20260107-005 not found!');
    return;
  }
  
  console.log(`\n📋 BFS Face Sheet: ${bfsFaceSheet.face_sheet_no} (ID: ${bfsFaceSheet.id}, Status: ${bfsFaceSheet.status})`);
  
  // 3. Check BFS items
  const { data: bfsItems } = await supabase
    .from('bonus_face_sheet_items')
    .select(`
      id,
      sku_id,
      quantity_picked,
      status,
      voided_at,
      package_id
    `)
    .eq('face_sheet_id', bfsFaceSheet.id);
  
  console.log('\n📦 BFS Items:');
  for (const item of bfsItems || []) {
    console.log(`  SKU: ${item.sku_id}`);
    console.log(`    Status: ${item.status} | Voided: ${item.voided_at ? 'YES' : 'NO'}`);
    console.log(`    Quantity Picked: ${item.quantity_picked}`);
    console.log(`    Package ID: ${item.package_id}`);
    
    // Get package details
    if (item.package_id) {
      const { data: pkg } = await supabase
        .from('bonus_face_sheet_packages')
        .select('package_number, storage_location, hub')
        .eq('id', item.package_id)
        .single();
      
      if (pkg) {
        console.log(`    Storage Location: ${pkg.storage_location || '(null = at staging)'}`);
        console.log(`    Hub: ${pkg.hub}`);
      }
    }
  }
  
  // 4. Check loadlists
  const { data: loadlists } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select(`
      loadlist_id,
      loadlists (
        loadlist_code,
        status
      )
    `)
    .eq('face_sheet_id', bfsFaceSheet.id);
  
  console.log('\n🚚 Loadlists:');
  if (loadlists && loadlists.length > 0) {
    loadlists.forEach(ll => {
      const loadlist = ll.loadlists;
      console.log(`  - ${loadlist?.loadlist_code} | Status: ${loadlist?.status}`);
    });
  } else {
    console.log('  (No loadlists)');
  }
  
  // 5. Summary
  console.log('\n🎯 Analysis:');
  const hasDispatchStock = dispatchStock && dispatchStock.length > 0;
  const allPackagesAtStaging = bfsItems?.every(item => {
    // Would need to check storage_location for each package
    return true; // Placeholder
  });
  
  if (hasDispatchStock) {
    console.log('❌ Problem: Stock exists at Dispatch location');
    console.log('   Solution: Need to move stock from Dispatch to MRTD');
  } else {
    console.log('✅ Stock location is correct (not at Dispatch)');
    console.log('⚠️ Issue might be in API filtering logic or frontend cache');
  }
}

deepInvestigate().catch(console.error);
