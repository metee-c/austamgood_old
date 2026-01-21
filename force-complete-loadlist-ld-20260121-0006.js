// Force complete loadlist LD-20260121-0006
// Move stock from Delivery-In-Progress to Dispatch and complete loading

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forceComplete() {
  console.log('🔧 Force completing loadlist LD-20260121-0006\n');

  // 1. Get location IDs
  const { data: dispatchLoc } = await supabase
    .from('master_location')
    .select('location_id')
    .eq('location_code', 'Dispatch')
    .single();

  const { data: deliveryLoc } = await supabase
    .from('master_location')
    .select('location_id')
    .eq('location_code', 'Delivery-In-Progress')
    .single();

  if (!dispatchLoc || !deliveryLoc) {
    console.error('❌ Cannot find Dispatch or Delivery-In-Progress location');
    return;
  }

  console.log('📍 Locations:');
  console.log(`  Dispatch: ${dispatchLoc.location_id}`);
  console.log(`  Delivery-In-Progress: ${deliveryLoc.location_id}\n`);

  // 2. Check all stock at Delivery-In-Progress
  const { data: deliveryStock } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('location_id', deliveryLoc.location_id)
    .eq('warehouse_id', 'WH001')
    .gt('total_piece_qty', 0);

  console.log(`📦 Found ${deliveryStock?.length || 0} SKUs at Delivery-In-Progress\n`);

  if (!deliveryStock || deliveryStock.length === 0) {
    console.log('✅ No stock to move - proceeding to mark loadlist as loaded\n');
  } else {
    // 3. Move all stock back to Dispatch
    console.log('🔄 Moving stock from Delivery-In-Progress to Dispatch...\n');

    for (const stock of deliveryStock) {
      console.log(`  Moving ${stock.sku_id}: ${stock.total_piece_qty} pieces`);

      // Check if there's already stock at Dispatch for this SKU
      const { data: existingDispatch } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('sku_id', stock.sku_id)
        .eq('location_id', dispatchLoc.location_id)
        .eq('warehouse_id', 'WH001')
        .eq('lot_no', stock.lot_no || '')
        .eq('production_date', stock.production_date || null)
        .eq('expiry_date', stock.expiry_date || null)
        .single();

      if (existingDispatch) {
        // Update existing balance
        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: existingDispatch.total_piece_qty + stock.total_piece_qty,
            total_pack_qty: existingDispatch.total_pack_qty + stock.total_pack_qty
          })
          .eq('balance_id', existingDispatch.balance_id);

        if (updateError) {
          console.error(`    ❌ Error updating Dispatch balance: ${updateError.message}`);
          continue;
        }
      } else {
        // Create new balance at Dispatch
        const { error: insertError } = await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: 'WH001',
            location_id: dispatchLoc.location_id,
            sku_id: stock.sku_id,
            total_piece_qty: stock.total_piece_qty,
            total_pack_qty: stock.total_pack_qty,
            reserved_piece_qty: 0,
            reserved_pack_qty: 0,
            lot_no: stock.lot_no,
            production_date: stock.production_date,
            expiry_date: stock.expiry_date,
            pallet_id: stock.pallet_id
          });

        if (insertError) {
          console.error(`    ❌ Error creating Dispatch balance: ${insertError.message}`);
          continue;
        }
      }

      // Delete from Delivery-In-Progress
      const { error: deleteError } = await supabase
        .from('wms_inventory_balances')
        .delete()
        .eq('balance_id', stock.balance_id);

      if (deleteError) {
        console.error(`    ❌ Error deleting Delivery-In-Progress balance: ${deleteError.message}`);
      } else {
        console.log(`    ✅ Moved successfully`);
      }
    }
    console.log('');
  }

  // 4. Mark loadlist as loaded
  console.log('📝 Marking loadlist as loaded...\n');

  const { error: updateLoadlistError } = await supabase
    .from('loadlists')
    .update({
      status: 'loaded'
    })
    .eq('loadlist_code', 'LD-20260121-0006');

  if (updateLoadlistError) {
    console.error('❌ Error updating loadlist:', updateLoadlistError);
    return;
  }

  // 5. Mark picklist as loaded
  const { error: updatePicklistError } = await supabase
    .from('wms_loadlist_picklists')
    .update({
      loaded_at: new Date().toISOString()
    })
    .eq('loadlist_id', 280)
    .eq('picklist_id', 327);

  if (updatePicklistError) {
    console.error('❌ Error updating picklist mapping:', updatePicklistError);
    return;
  }

  console.log('✅ Loadlist LD-20260121-0006 marked as loaded\n');

  // 6. Verify
  console.log('🔍 Verifying...\n');

  const { data: loadlist } = await supabase
    .from('loadlists')
    .select('status')
    .eq('loadlist_code', 'LD-20260121-0006')
    .single();

  console.log(`  Loadlist status: ${loadlist?.status}`);

  const { data: picklistMapping } = await supabase
    .from('wms_loadlist_picklists')
    .select('loaded_at')
    .eq('loadlist_id', 280)
    .eq('picklist_id', 327)
    .single();

  console.log(`  Picklist loaded_at: ${picklistMapping?.loaded_at || 'Not set'}`);

  console.log('\n✅ Force complete successful!');
}

forceComplete()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
