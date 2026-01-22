// Check what UI should display for this SKU
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUIDisplay() {
  const skuId = '01-NEC-D|LSD-S|012';
  
  console.log('🔍 Checking UI display for SKU:', skuId);
  console.log('='.repeat(80));
  
  // 1. Check master_sku
  const { data: sku } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, default_location')
    .eq('sku_id', skuId)
    .single();
  
  console.log('\n1️⃣ Master SKU:');
  console.log(`Name: ${sku.sku_name}`);
  console.log(`default_location: ${sku.default_location || '(NULL)'}`);
  
  // 2. Check mapping
  const { data: mappings } = await supabase
    .from('sku_preparation_area_mapping')
    .select(`
      *,
      preparation_area:preparation_area_id (
        area_code,
        area_name
      )
    `)
    .eq('sku_id', skuId);
  
  console.log('\n2️⃣ Mappings:');
  if (mappings.length === 0) {
    console.log('⚠️ No mappings found');
  } else {
    mappings.forEach(m => {
      console.log(`✅ ${m.preparation_area.area_code} (${m.preparation_area.area_name})`);
    });
  }
  
  // 3. Check inventory (what UI shows)
  const { data: inventory } = await supabase
    .from('vw_preparation_area_inventory')
    .select('*')
    .eq('sku_id', skuId);
  
  console.log('\n3️⃣ UI Display (vw_preparation_area_inventory):');
  if (inventory.length === 0) {
    console.log('⚠️ SKU will NOT be shown in UI');
  } else {
    console.log(`✅ SKU will be shown in ${inventory.length} location(s):`);
    inventory.forEach(inv => {
      console.log(`\n  Prep Area: ${inv.preparation_area_code} (${inv.preparation_area_name})`);
      console.log(`  Total Pack: ${inv.total_pack_qty}`);
      console.log(`  Total Piece: ${inv.total_piece_qty}`);
      console.log(`  Updated: ${inv.updated_at}`);
    });
  }
  
  // 4. Check if it should be in PK001
  console.log('\n4️⃣ Should this SKU be in PK001?');
  const { data: pk001Mapping } = await supabase
    .from('sku_preparation_area_mapping')
    .select(`
      *,
      preparation_area:preparation_area_id (
        area_code
      )
    `)
    .eq('sku_id', skuId)
    .eq('preparation_area.area_code', 'PK001');
  
  if (pk001Mapping && pk001Mapping.length > 0) {
    console.log('✅ YES - Has mapping to PK001');
  } else {
    console.log('❌ NO - No mapping to PK001');
  }
  
  // 5. Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(80));
  
  if (sku.default_location === 'PK001') {
    console.log('✅ default_location = PK001');
    console.log('   → Should show in PK001 on UI');
  } else if (sku.default_location === 'PK002') {
    console.log('✅ default_location = PK002');
    console.log('   → Should show in PK002 on UI');
    console.log('   → Should NOT show in PK001 on UI');
  } else if (!sku.default_location) {
    console.log('❌ default_location = NULL');
    console.log('   → Should NOT show anywhere on UI');
  } else {
    console.log(`✅ default_location = ${sku.default_location}`);
    console.log(`   → Should show in ${sku.default_location} on UI`);
  }
  
  console.log('\n🎯 ACTUAL UI BEHAVIOR:');
  if (inventory.length === 0) {
    console.log('❌ SKU is NOT shown in UI');
  } else {
    inventory.forEach(inv => {
      console.log(`✅ SKU is shown in ${inv.preparation_area_code}`);
    });
  }
  
  // Check if there's a mismatch
  const expectedLocation = sku.default_location;
  const actualLocations = inventory.map(i => i.preparation_area_code);
  
  console.log('\n🔍 MISMATCH CHECK:');
  if (!expectedLocation && actualLocations.length > 0) {
    console.log('❌ PROBLEM: default_location is NULL but SKU still shows in UI');
  } else if (expectedLocation && actualLocations.length === 0) {
    console.log('❌ PROBLEM: default_location is set but SKU does not show in UI');
  } else if (expectedLocation && actualLocations.length === 1 && actualLocations[0] === expectedLocation) {
    console.log('✅ CORRECT: UI matches default_location');
  } else if (expectedLocation && actualLocations.length === 1 && actualLocations[0] !== expectedLocation) {
    console.log('❌ PROBLEM: UI shows different location than default_location');
    console.log(`   Expected: ${expectedLocation}`);
    console.log(`   Actual: ${actualLocations[0]}`);
  } else {
    console.log('⚠️ UNCLEAR: Multiple locations or complex scenario');
  }
}

checkUIDisplay().catch(console.error);
