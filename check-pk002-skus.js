// Check SKUs in PK002 that start with 01- or 02-
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPK002SKUs() {
  console.log('🔍 Checking SKUs in PK002 that start with 01- or 02-');
  console.log('='.repeat(80));
  
  // 1. Check preparation_area_inventory
  console.log('\n1️⃣ Checking preparation_area_inventory (what UI shows):');
  const { data: inventory, error: invError } = await supabase
    .from('preparation_area_inventory')
    .select('sku_id, preparation_area_code, total_pack_qty, total_piece_qty')
    .eq('preparation_area_code', 'PK002')
    .or('sku_id.like.01-%,sku_id.like.02-%')
    .order('sku_id');
  
  if (invError) {
    console.error('❌ Error:', invError);
    return;
  }
  
  console.log(`Found ${inventory.length} SKUs in PK002 inventory:\n`);
  
  const skusWithStock = inventory.filter(i => i.total_piece_qty > 0);
  const skusWithoutStock = inventory.filter(i => i.total_piece_qty === 0);
  
  console.log(`📦 With stock: ${skusWithStock.length}`);
  console.log(`📭 Without stock (empty): ${skusWithoutStock.length}`);
  
  if (skusWithStock.length > 0) {
    console.log('\nSKUs with stock (first 10):');
    skusWithStock.slice(0, 10).forEach(sku => {
      console.log(`  ${sku.sku_id}: ${sku.total_pack_qty} packs, ${sku.total_piece_qty} pieces`);
    });
  }
  
  // 2. Check actual stock in wms_inventory_balances
  console.log('\n2️⃣ Checking actual stock in wms_inventory_balances:');
  const { data: actualStock, error: stockError } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, location_id, total_piece_qty')
    .eq('location_id', 'PK002')
    .or('sku_id.like.01-%,sku_id.like.02-%')
    .gt('total_piece_qty', 0)
    .order('sku_id');
  
  if (stockError) {
    console.error('❌ Error:', stockError);
  } else {
    console.log(`Found ${actualStock.length} SKUs with actual stock in PK002\n`);
    
    if (actualStock.length > 0) {
      console.log('SKUs with actual stock (first 10):');
      actualStock.slice(0, 10).forEach(sku => {
        console.log(`  ${sku.sku_id}: ${sku.total_piece_qty} pieces`);
      });
    }
  }
  
  // 3. Check mappings
  console.log('\n3️⃣ Checking sku_preparation_area_mapping:');
  const { data: mappings, error: mapError } = await supabase
    .from('sku_preparation_area_mapping')
    .select(`
      sku_id,
      preparation_area:preparation_area_id (
        area_code
      )
    `)
    .or('sku_id.like.01-%,sku_id.like.02-%');
  
  if (mapError) {
    console.error('❌ Error:', mapError);
  } else {
    const pk002Mappings = mappings.filter(m => m.preparation_area.area_code === 'PK002');
    console.log(`Found ${pk002Mappings.length} SKUs mapped to PK002\n`);
    
    if (pk002Mappings.length > 0) {
      console.log('Mapped SKUs (first 10):');
      pk002Mappings.slice(0, 10).forEach(m => {
        console.log(`  ${m.sku_id}`);
      });
    }
  }
  
  // 4. Check default_location
  console.log('\n4️⃣ Checking master_sku.default_location:');
  const { data: skus, error: skuError } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, default_location')
    .or('sku_id.like.01-%,sku_id.like.02-%')
    .eq('default_location', 'PK002')
    .order('sku_id');
  
  if (skuError) {
    console.error('❌ Error:', skuError);
  } else {
    console.log(`Found ${skus.length} SKUs with default_location = PK002\n`);
    
    if (skus.length > 0) {
      console.log('SKUs with default_location = PK002 (first 10):');
      skus.slice(0, 10).forEach(sku => {
        console.log(`  ${sku.sku_id}: ${sku.sku_name}`);
      });
    }
  }
  
  // 5. Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(80));
  
  console.log(`\nInventory records in PK002: ${inventory.length}`);
  console.log(`  - With stock: ${skusWithStock.length}`);
  console.log(`  - Empty (0 stock): ${skusWithoutStock.length}`);
  
  console.log(`\nActual stock in PK002: ${actualStock?.length || 0} SKUs`);
  console.log(`Mappings to PK002: ${pk002Mappings?.length || 0} SKUs`);
  console.log(`default_location = PK002: ${skus?.length || 0} SKUs`);
  
  console.log('\n🎯 ANALYSIS:');
  if (skusWithoutStock.length > 0) {
    console.log(`❌ PROBLEM: ${skusWithoutStock.length} SKUs show in UI with 0 stock`);
    console.log('   This is CORRECT behavior - UI shows mapped SKUs even with 0 stock');
    console.log('   But user says it should be EMPTY (not show at all)');
  }
  
  if (skus && skus.length > 0) {
    console.log(`\n⚠️ These SKUs have default_location = PK002`);
    console.log('   If user wants them to NOT show, need to change default_location');
  }
}

checkPK002SKUs().catch(console.error);
