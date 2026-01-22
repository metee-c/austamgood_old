// Check if triggers work when master_sku.default_location is changed
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTriggerFlow() {
  console.log('🔍 Checking trigger flow for SKU: 01-NEP-D|HEJ|012');
  console.log('='.repeat(80));
  
  const skuId = '01-NEP-D|HEJ|012';
  
  // 1. Check master_sku.default_location
  console.log('\n1️⃣ Checking master_sku.default_location:');
  const { data: sku, error: skuError } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, default_location')
    .eq('sku_id', skuId)
    .single();
  
  if (skuError) {
    console.error('❌ Error:', skuError);
    return;
  }
  
  console.log('SKU:', sku.sku_name);
  console.log('default_location:', sku.default_location || '(NULL)');
  
  // 2. Check sku_preparation_area_mapping
  console.log('\n2️⃣ Checking sku_preparation_area_mapping:');
  const { data: mappings, error: mappingError } = await supabase
    .from('sku_preparation_area_mapping')
    .select(`
      *,
      preparation_area:preparation_area_id (
        area_code,
        area_name,
        zone
      )
    `)
    .eq('sku_id', skuId);
  
  if (mappingError) {
    console.error('❌ Error:', mappingError);
  } else if (mappings.length === 0) {
    console.log('⚠️ No mappings found');
  } else {
    console.log(`✅ Found ${mappings.length} mapping(s):`);
    mappings.forEach(m => {
      console.log(`  - Prep Area: ${m.preparation_area.area_code} (${m.preparation_area.area_name})`);
      console.log(`    Zone: ${m.preparation_area.zone}`);
      console.log(`    Warehouse: ${m.warehouse_id}`);
    });
  }
  
  // 3. Check preparation_area_inventory
  console.log('\n3️⃣ Checking preparation_area_inventory:');
  const { data: inventory, error: invError } = await supabase
    .from('preparation_area_inventory')
    .select('*')
    .eq('sku_id', skuId);
  
  if (invError) {
    console.error('❌ Error:', invError);
  } else if (inventory.length === 0) {
    console.log('⚠️ No inventory records found');
  } else {
    console.log(`✅ Found ${inventory.length} inventory record(s):`);
    inventory.forEach(inv => {
      console.log(`  - Prep Area: ${inv.preparation_area_code}`);
      console.log(`    Total Pack Qty: ${inv.total_pack_qty}`);
      console.log(`    Total Piece Qty: ${inv.total_piece_qty}`);
      console.log(`    Updated At: ${inv.updated_at}`);
    });
  }
  
  // 4. Check if location exists in master_location
  if (sku.default_location) {
    console.log('\n4️⃣ Checking if default_location exists in master_location:');
    const { data: location, error: locError } = await supabase
      .from('master_location')
      .select('location_id, zone')
      .eq('location_id', sku.default_location)
      .single();
    
    if (locError) {
      console.error('❌ Location not found:', locError);
    } else {
      console.log('✅ Location found:');
      console.log(`  - Location ID: ${location.location_id}`);
      console.log(`  - Zone: ${location.zone}`);
      
      // Check if zone has prep area
      const { data: prepArea, error: paError } = await supabase
        .from('preparation_area')
        .select('area_id, area_code, area_name, zone')
        .eq('zone', location.zone)
        .single();
      
      if (paError) {
        console.error('❌ No prep area found for zone:', location.zone);
      } else {
        console.log('✅ Prep area found for zone:');
        console.log(`  - Area Code: ${prepArea.area_code}`);
        console.log(`  - Area Name: ${prepArea.area_name}`);
      }
    }
  }
  
  // 5. Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(80));
  
  const hasDefaultLocation = sku.default_location !== null && sku.default_location !== '';
  const hasMapping = mappings && mappings.length > 0;
  const hasInventory = inventory && inventory.length > 0;
  
  console.log(`default_location: ${hasDefaultLocation ? '✅ SET' : '❌ NULL/EMPTY'}`);
  console.log(`mapping exists: ${hasMapping ? '✅ YES' : '❌ NO'}`);
  console.log(`inventory exists: ${hasInventory ? '✅ YES' : '❌ NO'}`);
  
  console.log('\n🔍 EXPECTED BEHAVIOR:');
  if (!hasDefaultLocation) {
    console.log('✅ Since default_location is NULL/empty:');
    console.log('   - Trigger 275 should DELETE mapping');
    console.log('   - Trigger 284 should DELETE inventory');
    console.log('   - UI should NOT show this SKU');
  } else {
    console.log('✅ Since default_location is set:');
    console.log('   - Trigger 275 should CREATE/UPDATE mapping');
    console.log('   - Trigger 284 should CREATE/UPDATE inventory');
    console.log('   - UI should show this SKU');
  }
  
  console.log('\n🎯 ACTUAL BEHAVIOR:');
  if (!hasDefaultLocation && !hasMapping && !hasInventory) {
    console.log('✅ CORRECT: All triggers worked as expected');
  } else if (!hasDefaultLocation && (hasMapping || hasInventory)) {
    console.log('❌ PROBLEM: Triggers did not clean up properly');
    if (hasMapping) console.log('   - Mapping still exists (should be deleted)');
    if (hasInventory) console.log('   - Inventory still exists (should be deleted)');
  } else if (hasDefaultLocation && hasMapping && hasInventory) {
    console.log('✅ CORRECT: All triggers worked as expected');
  } else if (hasDefaultLocation && (!hasMapping || !hasInventory)) {
    console.log('❌ PROBLEM: Triggers did not create records');
    if (!hasMapping) console.log('   - Mapping missing (should be created)');
    if (!hasInventory) console.log('   - Inventory missing (should be created)');
  }
}

checkTriggerFlow().catch(console.error);
