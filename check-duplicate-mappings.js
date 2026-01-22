// Check for duplicate mappings
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDuplicateMappings() {
  const skuId = '01-NEC-D|LSD-S|012';
  
  console.log('🔍 Checking for duplicate mappings for SKU:', skuId);
  console.log('='.repeat(80));
  
  // Get ALL mappings (including inactive prep areas)
  const { data: mappings, error } = await supabase
    .from('sku_preparation_area_mapping')
    .select(`
      *,
      preparation_area:preparation_area_id (
        area_id,
        area_code,
        area_name,
        zone,
        status
      )
    `)
    .eq('sku_id', skuId);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`\n✅ Found ${mappings.length} mapping(s):\n`);
  
  mappings.forEach((m, idx) => {
    console.log(`${idx + 1}. Mapping ID: ${m.mapping_id}`);
    console.log(`   Prep Area ID: ${m.preparation_area_id}`);
    console.log(`   Prep Area Code: ${m.preparation_area.area_code}`);
    console.log(`   Prep Area Name: ${m.preparation_area.area_name}`);
    console.log(`   Zone: ${m.preparation_area.zone}`);
    console.log(`   Status: ${m.preparation_area.status}`);
    console.log(`   Warehouse: ${m.warehouse_id}`);
    console.log(`   Created: ${m.created_at}`);
    console.log(`   Updated: ${m.updated_at}`);
    console.log('');
  });
  
  // Check inventory records
  console.log('='.repeat(80));
  console.log('📦 Checking inventory records:\n');
  
  const { data: inventory } = await supabase
    .from('preparation_area_inventory')
    .select('*')
    .eq('sku_id', skuId);
  
  console.log(`✅ Found ${inventory.length} inventory record(s):\n`);
  
  inventory.forEach((inv, idx) => {
    console.log(`${idx + 1}. Inventory ID: ${inv.inventory_id}`);
    console.log(`   Prep Area ID: ${inv.preparation_area_id}`);
    console.log(`   Prep Area Code: ${inv.preparation_area_code}`);
    console.log(`   Warehouse: ${inv.warehouse_id}`);
    console.log(`   Total Pack: ${inv.total_pack_qty}`);
    console.log(`   Created: ${inv.created_at}`);
    console.log(`   Updated: ${inv.updated_at}`);
    console.log('');
  });
  
  // Analysis
  console.log('='.repeat(80));
  console.log('🔍 ANALYSIS:\n');
  
  const pk001Mapping = mappings.find(m => m.preparation_area.area_code === 'PK001');
  const pk002Mapping = mappings.find(m => m.preparation_area.area_code === 'PK002');
  const pk001Inventory = inventory.find(i => i.preparation_area_code === 'PK001');
  const pk002Inventory = inventory.find(i => i.preparation_area_code === 'PK002');
  
  console.log('PK001:');
  console.log(`  Mapping: ${pk001Mapping ? '✅ EXISTS' : '❌ NOT FOUND'}`);
  console.log(`  Inventory: ${pk001Inventory ? '✅ EXISTS' : '❌ NOT FOUND'}`);
  
  console.log('\nPK002:');
  console.log(`  Mapping: ${pk002Mapping ? '✅ EXISTS' : '❌ NOT FOUND'}`);
  console.log(`  Inventory: ${pk002Inventory ? '✅ EXISTS' : '❌ NOT FOUND'}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 PROBLEM IDENTIFIED:\n');
  
  if (pk001Mapping && pk002Mapping) {
    console.log('❌ DUPLICATE MAPPINGS FOUND!');
    console.log('   This SKU has mappings to BOTH PK001 and PK002');
    console.log('   But default_location is PK002');
    console.log('   → Trigger 275 should have DELETED the PK001 mapping');
    console.log('   → Or there are TWO separate mappings (not from trigger)');
  } else if (pk001Inventory && !pk001Mapping) {
    console.log('❌ ORPHANED INVENTORY RECORD!');
    console.log('   PK001 inventory exists but no mapping');
    console.log('   → Trigger 284 should have DELETED this inventory');
  } else if (pk001Mapping && pk001Inventory) {
    console.log('❌ STALE MAPPING!');
    console.log('   PK001 mapping still exists');
    console.log('   → Trigger 275 did not clean up when default_location changed');
  }
  
  // Check constraint
  console.log('\n' + '='.repeat(80));
  console.log('🔍 Checking UNIQUE constraint:\n');
  
  const { data: constraintCheck } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT 
          constraint_name,
          constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'sku_preparation_area_mapping'
          AND constraint_type = 'UNIQUE'
      `
    });
  
  console.log('Unique constraints:', constraintCheck);
}

checkDuplicateMappings().catch(console.error);
