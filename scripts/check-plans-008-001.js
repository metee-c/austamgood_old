const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPlans() {
  console.log('🔍 Checking plans RP-20260116-008 and RP-20260115-001...\n');

  // Get plans
  const { data: plans } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_name, status')
    .in('plan_code', ['RP-20260116-008', 'RP-20260115-001'])
    .order('plan_code');

  if (!plans || plans.length === 0) {
    console.log('❌ Plans not found');
    return;
  }

  for (const plan of plans) {
    console.log(`\n📋 Plan: ${plan.plan_code} (${plan.plan_name})`);
    console.log(`   Status: ${plan.status}`);

    // Get trips
    const { data: trips } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, trip_sequence, daily_trip_number')
      .eq('plan_id', plan.plan_id)
      .order('trip_sequence');

    console.log(`   Trips: ${trips?.length || 0}`);

    if (trips && trips.length > 0) {
      for (const trip of trips) {
        console.log(`\n   🚛 Trip ${trip.trip_id} (seq: ${trip.trip_sequence}, daily: ${trip.daily_trip_number})`);

        // Get stops with orders
        const { data: stops } = await supabase
          .from('receiving_route_stops')
          .select('stop_id, order_id, tags')
          .eq('trip_id', trip.trip_id);

        const orderIds = new Set();
        (stops || []).forEach(stop => {
          if (stop.order_id) orderIds.add(stop.order_id);
          if (stop.tags?.order_ids) {
            stop.tags.order_ids.forEach(id => orderIds.add(id));
          }
        });

        console.log(`      Stops: ${stops?.length || 0}, Orders: ${orderIds.size}`);

        if (orderIds.size > 0) {
          // Check order status
          const { data: orders } = await supabase
            .from('wms_orders')
            .select('order_id, order_no, status')
            .in('order_id', Array.from(orderIds));

          console.log(`      Order statuses:`);
          (orders || []).forEach(order => {
            console.log(`        - ${order.order_no}: ${order.status}`);
          });

          // Check if trip has picklist
          const { data: picklists } = await supabase
            .from('picklists')
            .select('picklist_id, picklist_code, status')
            .eq('trip_id', trip.trip_id);

          if (picklists && picklists.length > 0) {
            console.log(`      ✅ Has picklists: ${picklists.length}`);
            picklists.forEach(pl => {
              console.log(`        - ${pl.picklist_code}: ${pl.status}`);
            });
          } else {
            console.log(`      ❌ No picklists`);
          }
        }
      }
    }
  }
}

checkPlans()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
