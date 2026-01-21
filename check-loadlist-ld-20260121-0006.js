// Investigation script for loadlist LD-20260121-0006
// Check for duplicate picklist assignments and stock location issues

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function investigate() {
  console.log('🔍 Investigating loadlist LD-20260121-0006\n');

  // 1. Get loadlist details
  const { data: loadlist, error: loadlistError } = await supabase
    .from('loadlists')
    .select(`
      id,
      loadlist_code,
      status,
      trip_id,
      created_at
    `)
    .eq('loadlist_code', 'LD-20260121-0006')
    .single();

  if (loadlistError || !loadlist) {
    console.error('❌ Loadlist not found:', loadlistError);
    return;
  }

  console.log('📦 Loadlist Details:');
  console.log(`  ID: ${loadlist.id}`);
  console.log(`  Code: ${loadlist.loadlist_code}`);
  console.log(`  Status: ${loadlist.status}`);
  console.log(`  Trip ID: ${loadlist.trip_id}`);
  console.log(`  Created: ${loadlist.created_at}\n`);

  // Get trip details separately
  if (loadlist.trip_id) {
    const { data: trip } = await supabase
      .from('trips')
      .select('trip_code, daily_trip_number, route_plan_id')
      .eq('trip_id', loadlist.trip_id)
      .single();
    
    if (trip) {
      console.log(`  Trip Code: ${trip.trip_code}`);
      console.log(`  Daily Trip #: ${trip.daily_trip_number}`);
      console.log(`  Route Plan ID: ${trip.route_plan_id}\n`);
    }
  }

  // 2. Get picklists assigned to this loadlist
  const { data: picklistLinks } = await supabase
    .from('wms_loadlist_picklists')
    .select(`
      picklist_id,
      loaded_at,
      picklists!inner(
        picklist_code,
        status,
        trip_id
      )
    `)
    .eq('loadlist_id', loadlist.id);

  console.log(`📋 Picklists assigned to ${loadlist.loadlist_code}:`);
  const picklistIds = [];
  for (const link of picklistLinks || []) {
    picklistIds.push(link.picklist_id);
    console.log(`  - ${link.picklists.picklist_code} (ID: ${link.picklist_id})`);
    console.log(`    Status: ${link.picklists.status}`);
    console.log(`    Trip ID: ${link.picklists.trip_id}`);
    console.log(`    Loaded at: ${link.loaded_at || 'Not loaded'}`);
  }
  console.log('');

  // 3. Check for duplicate picklist assignments
  if (picklistIds.length > 0) {
    console.log('🔍 Checking for duplicate picklist assignments...\n');
    
    for (const picklistId of picklistIds) {
      const { data: allMappings } = await supabase
        .from('wms_loadlist_picklists')
        .select(`
          loadlist_id,
          loaded_at,
          loadlists!inner(
            loadlist_code,
            status,
            created_at
          )
        `)
        .eq('picklist_id', picklistId)
        .order('created_at', { ascending: true });

      if (allMappings && allMappings.length > 1) {
        console.log(`⚠️  DUPLICATE FOUND for Picklist ${picklistId}:`);
        for (const mapping of allMappings) {
          console.log(`  - ${mapping.loadlists.loadlist_code}`);
          console.log(`    Status: ${mapping.loadlists.status}`);
          console.log(`    Created: ${mapping.loadlists.created_at}`);
          console.log(`    Loaded: ${mapping.loaded_at || 'Not loaded'}`);
        }
        console.log('');
      }
    }
  }

  // 4. Check stock for problematic SKU
  const problematicSku = 'B-BEY-D|SAL|NS|012';
  console.log(`📊 Stock check for ${problematicSku}:\n`);

  // Get Dispatch location
  const { data: dispatchLoc } = await supabase
    .from('master_location')
    .select('location_id, location_code')
    .eq('location_code', 'Dispatch')
    .single();

  // Get Delivery-In-Progress location
  const { data: deliveryLoc } = await supabase
    .from('master_location')
    .select('location_id, location_code')
    .eq('location_code', 'Delivery-In-Progress')
    .single();

  // Check stock at Dispatch
  const { data: dispatchStock } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('sku_id', problematicSku)
    .eq('location_id', dispatchLoc.location_id)
    .eq('warehouse_id', 'WH001');

  const dispatchTotal = (dispatchStock || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
  console.log(`  Dispatch: ${dispatchTotal} pieces (${dispatchStock?.length || 0} balance records)`);

  // Check stock at Delivery-In-Progress
  const { data: deliveryStock } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('sku_id', problematicSku)
    .eq('location_id', deliveryLoc.location_id)
    .eq('warehouse_id', 'WH001');

  const deliveryTotal = (deliveryStock || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
  console.log(`  Delivery-In-Progress: ${deliveryTotal} pieces (${deliveryStock?.length || 0} balance records)\n`);

  // 5. Check picklist items for this SKU
  if (picklistIds.length > 0) {
    console.log(`📋 Picklist items for ${problematicSku}:\n`);
    
    const { data: picklistItems } = await supabase
      .from('picklist_items')
      .select(`
        *,
        picklists!inner(picklist_code)
      `)
      .in('picklist_id', picklistIds)
      .eq('sku_id', problematicSku);

    for (const item of picklistItems || []) {
      console.log(`  Picklist: ${item.picklists.picklist_code}`);
      console.log(`    Quantity to pick: ${item.quantity_to_pick}`);
      console.log(`    Quantity picked: ${item.quantity_picked}`);
      console.log(`    Status: ${item.status || 'N/A'}`);
    }
    console.log('');
  }

  // 6. Check recent stock movements for this SKU
  console.log(`📜 Recent stock movements for ${problematicSku}:\n`);
  
  const { data: recentMoves } = await supabase
    .from('wms_inventory_ledger')
    .select(`
      *,
      from_location:master_location!wms_inventory_ledger_from_location_id_fkey(location_code),
      to_location:master_location!wms_inventory_ledger_to_location_id_fkey(location_code)
    `)
    .eq('sku_id', problematicSku)
    .order('created_at', { ascending: false })
    .limit(10);

  for (const move of recentMoves || []) {
    console.log(`  ${move.created_at}`);
    console.log(`    Type: ${move.transaction_type}`);
    console.log(`    From: ${move.from_location?.location_code || 'N/A'}`);
    console.log(`    To: ${move.to_location?.location_code || 'N/A'}`);
    console.log(`    Qty: ${move.quantity_piece} pieces`);
    console.log(`    Reference: ${move.reference_document_type} ${move.reference_document_code || ''}`);
  }
}

investigate()
  .then(() => {
    console.log('\n✅ Investigation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
