const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSKU() {
  // Find SKUs that have picking homes
  const { data: skusWithHomes } = await supabase
    .from('wms_sku_preparation_area_mapping')
    .select(`
      sku_id,
      priority,
      wms_preparation_areas!inner (
        area_code,
        area_name_th,
        master_location!inner (
          location_code,
          location_name_th
        )
      )
    `)
    .order('priority', { ascending: true })
    .limit(5);

  console.log('=== SKUs with Picking Homes ===');
  console.log(JSON.stringify(skusWithHomes, null, 2));

  if (skusWithHomes && skusWithHomes.length > 0) {
    const testSku = skusWithHomes[0].sku_id;
    const pickingHome = skusWithHomes[0].wms_preparation_areas.master_location.location_code;

    console.log(`\n=== Testing SKU: ${testSku} ===`);
    console.log(`Designated Picking Home: ${pickingHome}`);

    // Find pallet with this SKU
    const { data: pallet } = await supabase
      .from('wms_inventory_balances')
      .select('sku_id, pallet_id, pallet_id_external, total_piece_qty, location_id, master_location(location_code)')
      .eq('sku_id', testSku)
      .gt('total_piece_qty', 0)
      .limit(1)
      .single();

    if (pallet) {
      console.log('\n=== Pallet Found ===');
      console.log(JSON.stringify(pallet, null, 2));
      console.log(`\nTest Scenarios:`);
      console.log(`✅ Move ${pallet.pallet_id} → ${pickingHome} (its own home) - SHOULD ALLOW`);
      console.log(`❌ Move ${pallet.pallet_id} → A09-01-999 (wrong home) - SHOULD BLOCK`);
      console.log(`✅ Move ${pallet.pallet_id} → A01-01-002 (bulk storage) - SHOULD ALLOW`);
    }
  }

  // Also test SKU without picking home
  const { data: anyPallet } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, pallet_id, pallet_id_external, total_piece_qty, location_id, master_location(location_code)')
    .gt('total_piece_qty', 0)
    .limit(1)
    .single();

  if (anyPallet) {
    const skuId = anyPallet.sku_id;
    
    // Check if this SKU has a designated picking home
    const { data: mapping } = await supabase
      .from('wms_sku_preparation_area_mapping')
      .select(`
        sku_id,
        priority,
        wms_preparation_areas!inner (
          area_code,
          area_name_th,
          master_location!inner (
            location_code,
            location_name_th
          )
        )
      `)
      .eq('sku_id', skuId)
      .order('priority', { ascending: true });

    console.log('\n=== SKU Without Picking Home ===');
    console.log(`SKU: ${skuId}`);
    console.log(`Has Picking Home: ${mapping && mapping.length > 0 ? 'Yes' : 'No'}`);
    if (mapping && mapping.length > 0) {
      console.log('Mapping:', JSON.stringify(mapping, null, 2));
    }
  }
}

checkSKU().catch(console.error);
