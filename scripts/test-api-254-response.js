const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAPI() {
  console.log('🔍 Testing API response for Plan 254...\n');

  // Simulate what the API should do
  const planId = 254;

  // Get stops
  const { data: stops } = await supabase
    .from('receiving_route_stops')
    .select('*')
    .eq('plan_id', planId);

  console.log('📍 Stops:', stops.length);

  // Collect order IDs
  const allOrderIds = new Set();
  stops.forEach(stop => {
    const orderIds = stop.tags?.order_ids || [];
    orderIds.forEach(id => allOrderIds.add(id));
    if (stop.order_id) allOrderIds.add(stop.order_id);
  });

  console.log('📝 Order IDs:', Array.from(allOrderIds));

  // Fetch orders
  const { data: orders } = await supabase
    .from('wms_orders')
    .select('order_id, order_no, customer_id, shop_name, province, total_weight')
    .in('order_id', Array.from(allOrderIds));

  console.log('\n📦 Orders fetched:', orders.length);
  
  const ordersMap = {};
  orders.forEach(order => {
    ordersMap[order.order_id] = order;
    console.log(`  ${order.order_id} → ${order.order_no}`);
  });

  // Build orders array for each stop
  console.log('\n🔨 Building orders array for each stop:');
  stops.forEach(stop => {
    const orderIds = stop.tags?.order_ids || (stop.order_id ? [stop.order_id] : []);
    console.log(`\n  Stop ${stop.stop_id} (${stop.stop_name}):`);
    console.log(`    Order IDs from tags: ${JSON.stringify(orderIds)}`);
    
    const ordersArray = orderIds.map(orderId => {
      const order = ordersMap[orderId];
      if (order) {
        console.log(`      ✅ ${orderId} → ${order.order_no} (${order.total_weight} kg)`);
        return {
          order_id: orderId,
          order_no: order.order_no,
          customer_id: order.customer_id,
          shop_name: order.shop_name,
          province: order.province,
          allocated_weight_kg: order.total_weight,
          total_order_weight_kg: order.total_weight
        };
      } else {
        console.log(`      ❌ ${orderId} → NOT FOUND IN ordersMap!`);
        return null;
      }
    }).filter(Boolean);

    console.log(`    Orders array length: ${ordersArray.length}`);
  });

  console.log('\n✅ Test complete!');
}

testAPI().catch(console.error);
