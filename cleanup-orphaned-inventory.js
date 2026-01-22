// Cleanup orphaned inventory records (inventory without mapping)
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupOrphanedInventory() {
  console.log('🧹 Cleaning up orphaned inventory records...');
  console.log('='.repeat(80));
  
  // Find all orphaned inventory records
  // (inventory records that don't have a corresponding mapping)
  const { data: orphaned, error: findError } = await supabase
    .from('preparation_area_inventory')
    .select(`
      inventory_id,
      warehouse_id,
      preparation_area_id,
      preparation_area_code,
      sku_id
    `);
  
  if (findError) {
    console.error('❌ Error finding inventory:', findError);
    return;
  }
  
  console.log(`\n📊 Found ${orphaned.length} total inventory records`);
  console.log('Checking which ones are orphaned...\n');
  
  const orphanedRecords = [];
  
  for (const inv of orphaned) {
    // Check if mapping exists
    const { data: mapping, error: mappingError } = await supabase
      .from('sku_preparation_area_mapping')
      .select('mapping_id')
      .eq('sku_id', inv.sku_id)
      .eq('warehouse_id', inv.warehouse_id)
      .eq('preparation_area_id', inv.preparation_area_id)
      .single();
    
    if (mappingError && mappingError.code === 'PGRST116') {
      // No mapping found - this is orphaned
      orphanedRecords.push(inv);
    }
  }
  
  console.log(`❌ Found ${orphanedRecords.length} orphaned inventory records:\n`);
  
  if (orphanedRecords.length === 0) {
    console.log('✅ No orphaned records to clean up!');
    return;
  }
  
  // Show orphaned records
  orphanedRecords.forEach((rec, idx) => {
    console.log(`${idx + 1}. SKU: ${rec.sku_id}`);
    console.log(`   Prep Area: ${rec.preparation_area_code}`);
    console.log(`   Inventory ID: ${rec.inventory_id}`);
    console.log('');
  });
  
  // Delete orphaned records
  console.log('='.repeat(80));
  console.log('🗑️  Deleting orphaned records...\n');
  
  let deletedCount = 0;
  
  for (const rec of orphanedRecords) {
    const { error: deleteError } = await supabase
      .from('preparation_area_inventory')
      .delete()
      .eq('inventory_id', rec.inventory_id);
    
    if (deleteError) {
      console.error(`❌ Failed to delete ${rec.inventory_id}:`, deleteError);
    } else {
      console.log(`✅ Deleted: ${rec.sku_id} from ${rec.preparation_area_code}`);
      deletedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(80));
  console.log(`Total orphaned records: ${orphanedRecords.length}`);
  console.log(`Successfully deleted: ${deletedCount}`);
  console.log(`Failed: ${orphanedRecords.length - deletedCount}`);
  
  if (deletedCount === orphanedRecords.length) {
    console.log('\n✅ All orphaned records cleaned up successfully!');
  }
}

cleanupOrphanedInventory().catch(console.error);
