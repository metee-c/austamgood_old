const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTask() {
  const taskId = '913a15a6-9f5e-4f8d-97cf-5fd5414e9611';
  const palletId = 'ATG2500012472';
  
  console.log('=== Checking Replenishment Task ===');
  console.log('Task ID:', taskId);
  console.log('Pallet ID:', palletId);
  console.log('');
  
  // Get task details
  const { data: task, error } = await supabase
    .from('replenishment_queue')
    .select(`
      *,
      master_sku:sku_id (sku_id, sku_name, uom_base, qty_per_pack),
      from_location:from_location_id (location_id, location_code, location_name),
      to_location:to_location_id (location_id, location_code, location_name)
    `)
    .eq('queue_id', taskId)
    .single();
  
  if (error) {
    console.log('Error fetching task:', error);
    return;
  }
  
  console.log('Task Details:');
  console.log('  SKU:', task.sku_id);
  console.log('  SKU Name:', task.master_sku?.sku_name);
  console.log('  From Location:', task.from_location_id, '-', task.from_location?.location_code);
  console.log('  To Location:', task.to_location_id, '-', task.to_location?.location_code);
  console.log('  Requested Qty:', task.requested_qty);
  console.log('  Status:', task.status);
  console.log('  Pallet ID:', task.pallet_id);
  console.log('');
  
  // Check pallet stock
  const { data: palletStock, error: stockError } = await supabase
    .from('wms_inventory_balances')
    .select('*, master_location:location_id(location_id, location_code)')
    .eq('pallet_id', palletId)
    .eq('sku_id', task.sku_id)
    .gt('total_piece_qty', 0)
    .single();
  
  if (stockError || !palletStock) {
    console.log('Pallet Stock Error:', stockError || 'No stock found');
  } else {
    console.log('Pallet Stock:');
    console.log('  Location:', palletStock.location_id, '-', palletStock.master_location?.location_code);
    console.log('  Total Qty:', palletStock.total_piece_qty);
    console.log('');
  }
  
  // Check if to_location is a prep area
  const { data: prepArea, error: prepError } = await supabase
    .from('preparation_area')
    .select('area_id, area_name, area_code')
    .eq('area_code', task.to_location_id)
    .maybeSingle();
  
  console.log('Prep Area Check:');
  if (prepError) {
    console.log('  Error:', prepError);
  } else if (!prepArea) {
    console.log('  Not a prep area - validation will pass');
  } else {
    console.log('  IS a prep area:', prepArea.area_code, '-', prepArea.area_name);
    console.log('');
    
    // Check SKU mapping
    const { data: mapping, error: mapError } = await supabase
      .from('sku_preparation_area_mapping')
      .select('*')
      .eq('sku_id', task.sku_id)
      .eq('preparation_area_id', prepArea.area_id)
      .maybeSingle();
    
    console.log('SKU Mapping Check:');
    if (mapError) {
      console.log('  Error:', mapError);
    } else if (!mapping) {
      console.log('  ❌ NO MAPPING FOUND - This will cause validation to fail!');
      console.log('');
      
      // Check correct mapping
      const { data: correctMapping } = await supabase
        .from('sku_preparation_area_mapping')
        .select(`
          preparation_area_id,
          preparation_area:preparation_area_id (area_name, area_code)
        `)
        .eq('sku_id', task.sku_id)
        .eq('is_primary', true)
        .maybeSingle();
      
      if (correctMapping) {
        console.log('Correct Prep Area for this SKU:');
        console.log('  Area Code:', correctMapping.preparation_area?.area_code);
        console.log('  Area Name:', correctMapping.preparation_area?.area_name);
      } else {
        console.log('No primary prep area mapping found for this SKU');
      }
    } else {
      console.log('  ✅ Mapping exists - validation will pass');
      console.log('  Mapping ID:', mapping.mapping_id);
    }
  }
}

checkTask().catch(console.error);
