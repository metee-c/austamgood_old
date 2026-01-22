// Test trigger 285: Change default_location and verify cleanup
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTrigger() {
  console.log('🧪 Testing Trigger 285: Auto cleanup when default_location changes');
  console.log('='.repeat(80));
  
  const testSku = '01-NEC-D|LSD-S|012';
  
  // 1. Check current state
  console.log('\n1️⃣ Current state:');
  const { data: currentSku } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, default_location')
    .eq('sku_id', testSku)
    .single();
  
  console.log(`SKU: ${currentSku.sku_name}`);
  console.log(`default_location: ${currentSku.default_location}`);
  
  const { data: currentMappings } = await supabase
    .from('sku_preparation_area_mapping')
    .select('preparation_area_id, preparation_area:preparation_area_id(area_code)')
    .eq('sku_id', testSku);
  
  console.log(`Mappings: ${currentMappings.map(m => m.preparation_area.area_code).join(', ')}`);
  
  const { data: currentInventory } = await supabase
    .from('preparation_area_inventory')
    .select('preparation_area_code')
    .eq('sku_id', testSku);
  
  console.log(`Inventory: ${currentInventory.map(i => i.preparation_area_code).join(', ')}`);
  
  // 2. Change default_location from PK002 to PK001
  console.log('\n2️⃣ Changing default_location from PK002 to PK001...');
  
  const { error: updateError } = await supabase
    .from('master_sku')
    .update({ default_location: 'PK001' })
    .eq('sku_id', testSku);
  
  if (updateError) {
    console.error('❌ Update failed:', updateError);
    return;
  }
  
  console.log('✅ Updated default_location to PK001');
  
  // Wait a bit for triggers to execute
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 3. Check new state
  console.log('\n3️⃣ New state after change:');
  
  const { data: newMappings } = await supabase
    .from('sku_preparation_area_mapping')
    .select('preparation_area_id, preparation_area:preparation_area_id(area_code)')
    .eq('sku_id', testSku);
  
  console.log(`Mappings: ${newMappings.map(m => m.preparation_area.area_code).join(', ')}`);
  
  const { data: newInventory } = await supabase
    .from('preparation_area_inventory')
    .select('preparation_area_code')
    .eq('sku_id', testSku);
  
  console.log(`Inventory: ${newInventory.map(i => i.preparation_area_code).join(', ')}`);
  
  // 4. Verify results
  console.log('\n' + '='.repeat(80));
  console.log('🔍 VERIFICATION:');
  console.log('='.repeat(80));
  
  const hasPK001Mapping = newMappings.some(m => m.preparation_area.area_code === 'PK001');
  const hasPK002Mapping = newMappings.some(m => m.preparation_area.area_code === 'PK002');
  const hasPK001Inventory = newInventory.some(i => i.preparation_area_code === 'PK001');
  const hasPK002Inventory = newInventory.some(i => i.preparation_area_code === 'PK002');
  
  console.log('\nExpected:');
  console.log('  - PK001 mapping: ✅ YES');
  console.log('  - PK002 mapping: ❌ NO (should be deleted)');
  console.log('  - PK001 inventory: ✅ YES');
  console.log('  - PK002 inventory: ❌ NO (should be deleted)');
  
  console.log('\nActual:');
  console.log(`  - PK001 mapping: ${hasPK001Mapping ? '✅ YES' : '❌ NO'}`);
  console.log(`  - PK002 mapping: ${hasPK002Mapping ? '❌ YES (PROBLEM!)' : '✅ NO'}`);
  console.log(`  - PK001 inventory: ${hasPK001Inventory ? '✅ YES' : '❌ NO'}`);
  console.log(`  - PK002 inventory: ${hasPK002Inventory ? '❌ YES (PROBLEM!)' : '✅ NO'}`);
  
  const success = hasPK001Mapping && !hasPK002Mapping && hasPK001Inventory && !hasPK002Inventory;
  
  console.log('\n' + '='.repeat(80));
  if (success) {
    console.log('✅ TEST PASSED: Triggers working correctly!');
  } else {
    console.log('❌ TEST FAILED: Triggers not working as expected');
  }
  console.log('='.repeat(80));
  
  // 5. Restore original state
  console.log('\n5️⃣ Restoring original state (PK002)...');
  
  await supabase
    .from('master_sku')
    .update({ default_location: 'PK002' })
    .eq('sku_id', testSku);
  
  console.log('✅ Restored default_location to PK002');
}

testTrigger().catch(console.error);
