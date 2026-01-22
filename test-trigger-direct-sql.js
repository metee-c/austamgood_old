// Test trigger by updating directly via SQL
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTriggerDirectSQL() {
  console.log('🧪 Testing Trigger via Direct SQL UPDATE');
  console.log('='.repeat(80));
  
  const testSku = '01-NEC-D|LSD-S|012';
  
  // 1. Check current state
  console.log('\n1️⃣ Current state:');
  
  let result = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        ms.sku_id,
        ms.sku_name,
        ms.default_location,
        (SELECT COUNT(*) FROM sku_preparation_area_mapping WHERE sku_id = ms.sku_id) as mapping_count,
        (SELECT COUNT(*) FROM preparation_area_inventory WHERE sku_id = ms.sku_id) as inventory_count
      FROM master_sku ms
      WHERE ms.sku_id = '${testSku}'
    `
  });
  
  console.log('SKU:', result.data[0].sku_name);
  console.log('default_location:', result.data[0].default_location);
  console.log('Mapping count:', result.data[0].mapping_count);
  console.log('Inventory count:', result.data[0].inventory_count);
  
  // Show details
  result = await supabase.rpc('exec_sql', {
    query: `
      SELECT pa.area_code
      FROM sku_preparation_area_mapping spam
      INNER JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
      WHERE spam.sku_id = '${testSku}'
    `
  });
  console.log('Mappings:', result.data.map(r => r.area_code).join(', '));
  
  result = await supabase.rpc('exec_sql', {
    query: `
      SELECT preparation_area_code
      FROM preparation_area_inventory
      WHERE sku_id = '${testSku}'
    `
  });
  console.log('Inventory:', result.data.map(r => r.preparation_area_code).join(', '));
  
  // 2. Update via SQL
  console.log('\n2️⃣ Updating default_location from PK002 to PK001 via SQL...');
  
  result = await supabase.rpc('exec_sql', {
    query: `
      UPDATE master_sku
      SET default_location = 'PK001'
      WHERE sku_id = '${testSku}'
      RETURNING sku_id, default_location
    `
  });
  
  if (result.error) {
    console.error('❌ Update failed:', result.error);
    return;
  }
  
  console.log('✅ Updated:', result.data[0]);
  
  // Wait for triggers
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 3. Check new state
  console.log('\n3️⃣ New state after update:');
  
  result = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        ms.sku_id,
        ms.default_location,
        (SELECT COUNT(*) FROM sku_preparation_area_mapping WHERE sku_id = ms.sku_id) as mapping_count,
        (SELECT COUNT(*) FROM preparation_area_inventory WHERE sku_id = ms.sku_id) as inventory_count
      FROM master_sku ms
      WHERE ms.sku_id = '${testSku}'
    `
  });
  
  console.log('default_location:', result.data[0].default_location);
  console.log('Mapping count:', result.data[0].mapping_count);
  console.log('Inventory count:', result.data[0].inventory_count);
  
  result = await supabase.rpc('exec_sql', {
    query: `
      SELECT pa.area_code
      FROM sku_preparation_area_mapping spam
      INNER JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
      WHERE spam.sku_id = '${testSku}'
    `
  });
  console.log('Mappings:', result.data.map(r => r.area_code).join(', '));
  
  result = await supabase.rpc('exec_sql', {
    query: `
      SELECT preparation_area_code
      FROM preparation_area_inventory
      WHERE sku_id = '${testSku}'
      ORDER BY preparation_area_code
    `
  });
  console.log('Inventory:', result.data.map(r => r.preparation_area_code).join(', '));
  
  // 4. Verify
  console.log('\n' + '='.repeat(80));
  console.log('🔍 VERIFICATION:');
  console.log('='.repeat(80));
  
  const mappings = result.data.map(r => r.preparation_area_code);
  const hasPK001 = mappings.includes('PK001');
  const hasPK002 = mappings.includes('PK002');
  
  console.log('\nExpected:');
  console.log('  - Only PK001 mapping and inventory');
  console.log('  - No PK002 mapping or inventory');
  
  console.log('\nActual:');
  console.log(`  - PK001: ${hasPK001 ? '✅ YES' : '❌ NO'}`);
  console.log(`  - PK002: ${hasPK002 ? '❌ YES (PROBLEM!)' : '✅ NO'}`);
  
  if (hasPK001 && !hasPK002) {
    console.log('\n✅ TEST PASSED!');
  } else {
    console.log('\n❌ TEST FAILED!');
  }
  
  // 5. Restore
  console.log('\n5️⃣ Restoring to PK002...');
  await supabase.rpc('exec_sql', {
    query: `UPDATE master_sku SET default_location = 'PK002' WHERE sku_id = '${testSku}'`
  });
  console.log('✅ Restored');
}

testTriggerDirectSQL().catch(console.error);
