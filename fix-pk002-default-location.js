// Fix default_location for SKUs starting with 01- or 02- in PK002
// These should NOT be in PK002 according to user
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixPK002DefaultLocation() {
  console.log('🔧 Fixing default_location for SKUs in PK002');
  console.log('='.repeat(80));
  
  // 1. Get all SKUs with default_location = PK002 that start with 01- or 02-
  console.log('\n1️⃣ Finding SKUs to fix...');
  const { data: skus, error: findError } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, default_location')
    .or('sku_id.like.01-%,sku_id.like.02-%')
    .eq('default_location', 'PK002')
    .order('sku_id');
  
  if (findError) {
    console.error('❌ Error:', findError);
    return;
  }
  
  console.log(`Found ${skus.length} SKUs with default_location = PK002\n`);
  
  if (skus.length === 0) {
    console.log('✅ No SKUs to fix!');
    return;
  }
  
  // Show first 20
  console.log('SKUs to be updated (first 20):');
  skus.slice(0, 20).forEach((sku, idx) => {
    console.log(`${idx + 1}. ${sku.sku_id}: ${sku.sku_name}`);
  });
  
  if (skus.length > 20) {
    console.log(`... and ${skus.length - 20} more`);
  }
  
  // 2. Ask for confirmation
  console.log('\n' + '='.repeat(80));
  console.log('⚠️  WARNING: This will update default_location to NULL for these SKUs');
  console.log('   This will trigger:');
  console.log('   - Trigger 275: Delete mappings from sku_preparation_area_mapping');
  console.log('   - Trigger 284: Delete inventory from preparation_area_inventory');
  console.log('   - UI: These SKUs will NO LONGER show in PK002');
  console.log('='.repeat(80));
  
  // For safety, require manual confirmation
  console.log('\n❓ To proceed, run this script with --confirm flag');
  console.log('   Example: node fix-pk002-default-location.js --confirm');
  
  if (!process.argv.includes('--confirm')) {
    console.log('\n⏸️  Dry run complete. No changes made.');
    return;
  }
  
  // 3. Update default_location to NULL
  console.log('\n2️⃣ Updating default_location to NULL...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const sku of skus) {
    const { error: updateError } = await supabase
      .from('master_sku')
      .update({ default_location: null })
      .eq('sku_id', sku.sku_id);
    
    if (updateError) {
      console.error(`❌ Failed: ${sku.sku_id} - ${updateError.message}`);
      errorCount++;
    } else {
      successCount++;
      if (successCount % 10 === 0) {
        console.log(`✅ Updated ${successCount}/${skus.length} SKUs...`);
      }
    }
  }
  
  // 4. Wait for triggers to complete
  console.log('\n⏳ Waiting for triggers to complete...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 5. Verify results
  console.log('\n3️⃣ Verifying results...\n');
  
  const { data: remainingMappings } = await supabase
    .from('sku_preparation_area_mapping')
    .select('sku_id, preparation_area:preparation_area_id(area_code)')
    .or('sku_id.like.01-%,sku_id.like.02-%')
    .eq('preparation_area.area_code', 'PK002');
  
  const { data: remainingInventory } = await supabase
    .from('preparation_area_inventory')
    .select('sku_id, preparation_area_code')
    .or('sku_id.like.01-%,sku_id.like.02-%')
    .eq('preparation_area_code', 'PK002');
  
  // 6. Summary
  console.log('='.repeat(80));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(80));
  console.log(`\nTotal SKUs processed: ${skus.length}`);
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  
  console.log(`\nRemaining mappings in PK002: ${remainingMappings?.length || 0}`);
  console.log(`Remaining inventory in PK002: ${remainingInventory?.length || 0}`);
  
  if (remainingMappings && remainingMappings.length > 0) {
    console.log('\n⚠️ Some mappings still exist:');
    remainingMappings.slice(0, 10).forEach(m => {
      console.log(`  - ${m.sku_id}`);
    });
  }
  
  if (remainingInventory && remainingInventory.length > 0) {
    console.log('\n⚠️ Some inventory records still exist:');
    remainingInventory.slice(0, 10).forEach(i => {
      console.log(`  - ${i.sku_id}`);
    });
  }
  
  if (successCount === skus.length && 
      (!remainingMappings || remainingMappings.length === 0) && 
      (!remainingInventory || remainingInventory.length === 0)) {
    console.log('\n✅ SUCCESS: All SKUs updated and cleaned up!');
    console.log('   UI will no longer show these SKUs in PK002');
  } else {
    console.log('\n⚠️ PARTIAL SUCCESS: Some issues remain');
    console.log('   Please check the remaining mappings/inventory above');
  }
}

fixPK002DefaultLocation().catch(console.error);
