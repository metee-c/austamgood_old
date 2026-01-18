const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPlan254() {
  console.log('🔍 Checking Plan 254 data...\n');

  // 1. Get plan
  const { data: plan } = await supabase
    .from('receiving_route_plans')
    .select('*')
    .eq('plan_id', 254)
    .single();

  console.log('📋 Plan:', {
    plan_id: plan.plan_id,
    plan_code: plan.plan_code,
    status: plan.status,
    trip_count: plan.trip_count
  });

  // 2. Get trips
  const { data: trips } = await supabase
    .from('receiving_route_trips')
    .select('*')
    .eq('plan_id', 254)
    .order('trip_sequence');

  console.log('\n🚚 Trips:', trips.length);
  trips.forEach(trip => {
    console.log(`  Trip ${trip.trip_id}: sequence=${trip.trip_sequence}, daily_number=${trip.daily_trip_number}`);
  });

  // 3. Get stops with tags
  const { data: stops } = await supabase
    .from('receiving_route_stops')
    .select('*')
    .eq('plan_id', 254)
    .order('trip_id, sequence_no');

  console.log('\n📍 Stops:', stops.length);
  stops.forEach(stop => {
    console.log(`  Stop ${stop.stop_id}:`, {
      trip_id: stop.trip_id,
      sequence: stop.sequence_no,
      order_id: stop.order_id,
      stop_name: stop.stop_name,
      weight: stop.load_weight_kg,
      tags: stop.tags
    });
  });

  // 4. Get stop items
  const { data: stopItems } = await supabase
    .from('receiving_route_stop_items')
    .select('*')
    .eq('plan_id', 254)
    .order('stop_id, order_id');

  console.log('\n📦 Stop Items:', stopItems.length);
  
  // Group by stop_id
  const itemsByStop = {};
  stopItems.forEach(item => {
    if (!itemsByStop[item.stop_id]) {
      itemsByStop[item.stop_id] = {};
    }
    if (!itemsByStop[item.stop_id][item.order_id]) {
      itemsByStop[item.stop_id][item.order_id] = [];
    }
    itemsByStop[item.stop_id][item.order_id].push(item);
  });

  Object.entries(itemsByStop).forEach(([stopId, orders]) => {
    console.log(`  Stop ${stopId}:`);
    Object.entries(orders).forEach(([orderId, items]) => {
      const totalQty = items.reduce((sum, item) => sum + Number(item.allocated_quantity || 0), 0);
      const totalWeight = items.reduce((sum, item) => sum + Number(item.allocated_weight_kg || 0), 0);
      console.log(`    Order ${orderId}: ${items.length} items, ${totalQty} qty, ${totalWeight.toFixed(1)} kg`);
    });
  });

  // 5. Get orders
  const { data: orders } = await supabase
    .from('wms_orders')
    .select('order_id, order_no, status, total_weight')
    .in('order_id', [7440, 7442, 7441, 7439, 7443]);

  console.log('\n📝 Orders:');
  orders.forEach(order => {
    console.log(`  ${order.order_no} (${order.order_id}): status=${order.status}, weight=${order.total_weight} kg`);
  });

  // 6. Check what API would return
  console.log('\n🔍 Simulating API response...');
  
  const allOrderIds = new Set();
  const allStopIds = [];
  
  stops.forEach(stop => {
    allStopIds.push(stop.stop_id);
    const orderIds = stop.tags?.order_ids || [];
    orderIds.forEach(id => allOrderIds.add(id));
    if (stop.order_id) allOrderIds.add(stop.order_id);
  });

  console.log('Order IDs collected:', Array.from(allOrderIds));
  console.log('Stop IDs:', allStopIds);

  // 7. Get order items
  const { data: orderItems } = await supabase
    .from('wms_order_items')
    .select('order_id, order_item_id, sku_id, sku_name, order_qty, order_weight')
    .in('order_id', Array.from(allOrderIds));

  console.log('\n📦 Order Items:', orderItems.length);
  const itemsByOrder = {};
  orderItems.forEach(item => {
    if (!itemsByOrder[item.order_id]) {
      itemsByOrder[item.order_id] = [];
    }
    itemsByOrder[item.order_id].push(item);
  });

  Object.entries(itemsByOrder).forEach(([orderId, items]) => {
    const totalQty = items.reduce((sum, item) => sum + Number(item.order_qty || 0), 0);
    console.log(`  Order ${orderId}: ${items.length} items, ${totalQty} qty`);
  });

  console.log('\n✅ Check complete!');
}

checkPlan254().catch(console.error);
