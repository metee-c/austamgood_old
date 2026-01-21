// Check picklist 327 complete details

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPicklist() {
  console.log('🔍 Checking Picklist 327 (PL-20260120-003)\n');

  // Get picklist details
  const { data: picklist, error: picklistError } = await supabase
    .from('picklists')
    .select('*')
    .eq('id', 327)
    .single();

  if (picklistError || !picklist) {
    console.error('❌ Picklist not found:', picklistError);
    return;
  }

  console.log('📋 Picklist Details:');
  console.log(`   ID: ${picklist.id}`);
  console.log(`   Code: ${picklist.picklist_code}`);
  console.log(`   Status: ${picklist.status}`);
  console.log(`   Trip ID: ${picklist.trip_id}`);
  console.log(`   Created: ${picklist.created_at}`);
  console.log(`   Completed: ${picklist.completed_at || 'Not completed'}`);
  console.log('');

  // Get picklist items
  const { data: items } = await supabase
    .from('picklist_items')
    .select(`
      *,
      sku:master_sku!picklist_items_sku_id_fkey(sku_id, sku_name, qty_per_pack)
    `)
    .eq('picklist_id', 327);

  console.log(`📦 Picklist Items: ${items?.length || 0}\n`);

  if (items && items.length > 0) {
    for (const item of items) {
      console.log(`   SKU: ${item.sku_id}`);
      console.log(`   Name: ${item.sku?.sku_name || 'N/A'}`);
      console.log(`   To pick: ${item.quantity_to_pick}`);
      console.log(`   Picked: ${item.quantity_picked}`);
      console.log(`   Status: ${item.status || 'N/A'}`);
      console.log('');
    }
  } else {
    console.log('   ⚠️  No items found!\n');
  }

  // Check trip details
  if (picklist.trip_id) {
    console.log('🚚 Trip Details:\n');
    
    const { data: trip } = await supabase
      .from('trips')
      .select(`
        *,
        route_plan:route_plans!trips_route_plan_id_fkey(
          route_plan_code,
          plan_date,
          status
        )
      `)
      .eq('trip_id', picklist.trip_id)
      .single();

    if (trip) {
      console.log(`   Trip ID: ${trip.trip_id}`);
      console.log(`   Trip Code: ${trip.trip_code}`);
      console.log(`   Daily Trip #: ${trip.daily_trip_number}`);
      console.log(`   Status: ${trip.status}`);
      console.log(`   Route Plan: ${trip.route_plan?.route_plan_code || 'N/A'}`);
      console.log(`   Plan Date: ${trip.route_plan?.plan_date || 'N/A'}`);
      console.log('');

      // Get stops in this trip
      const { data: stops } = await supabase
        .from('stops')
        .select(`
          stop_id,
          stop_sequence,
          customer_id,
          customers!stops_customer_id_fkey(customer_name)
        `)
        .eq('trip_id', trip.trip_id)
        .order('stop_sequence');

      console.log(`   Stops: ${stops?.length || 0}`);
      for (const stop of stops || []) {
        console.log(`     ${stop.stop_sequence}. ${stop.customers?.customer_name || 'N/A'}`);
      }
      console.log('');
    }
  }

  // Check if there are orders associated with this trip
  console.log('📦 Orders in Trip 878:\n');
  
  const { data: orders } = await supabase
    .from('wms_orders')
    .select(`
      order_id,
      order_no,
      customer_id,
      customers!wms_orders_customer_id_fkey(customer_name),
      order_items!wms_orders_order_id_fkey(
        sku_id,
        quantity,
        master_sku!order_items_sku_id_fkey(sku_name)
      )
    `)
    .eq('trip_id', 878);

  console.log(`   Found ${orders?.length || 0} orders\n`);

  if (orders && orders.length > 0) {
    for (const order of orders) {
      console.log(`   Order: ${order.order_no}`);
      console.log(`   Customer: ${order.customers?.customer_name || 'N/A'}`);
      console.log(`   Items: ${order.order_items?.length || 0}`);
      
      // Check for the problematic SKU
      const problematicItem = order.order_items?.find(
        item => item.sku_id === 'B-BEY-D|SAL|NS|012'
      );
      
      if (problematicItem) {
        console.log(`   ⚠️  Contains B-BEY-D|SAL|NS|012: ${problematicItem.quantity} pieces`);
      }
      console.log('');
    }
  }
}

checkPicklist()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
