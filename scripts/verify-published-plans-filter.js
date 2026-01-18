const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyFilter() {
  console.log('🔍 Verifying published plans filter logic...\n');

  // Get all approved plans
  const { data: plans } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_name, status')
    .eq('status', 'approved')
    .order('plan_date', { ascending: false });

  console.log(`📋 Found ${plans?.length || 0} approved plans\n`);

  const issues = [];

  for (const plan of plans || []) {
    console.log(`\n🔍 Checking ${plan.plan_code}...`);

    // Get trips
    const { data: trips } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, trip_sequence')
      .eq('plan_id', plan.plan_id);

    if (!trips || trips.length === 0) {
      console.log(`   ⚠️  No trips found`);
      issues.push({
        plan: plan.plan_code,
        issue: 'No trips',
        shouldShow: false
      });
      continue;
    }

    let hasValidTrip = false;
    let allTripsProcessed = true;

    for (const trip of trips) {
      // Get stops
      const { data: stops } = await supabase
        .from('receiving_route_stops')
        .select('stop_id, order_id, tags')
        .eq('trip_id', trip.trip_id);

      if (!stops || stops.length === 0) {
        console.log(`   Trip ${trip.trip_id}: No stops (empty trip)`);
        continue;
      }

      // Collect order IDs
      const orderIds = new Set();
      stops.forEach(stop => {
        if (stop.order_id) orderIds.add(stop.order_id);
        if (stop.tags?.order_ids) {
          stop.tags.order_ids.forEach(id => orderIds.add(id));
        }
      });

      if (orderIds.size === 0) {
        console.log(`   Trip ${trip.trip_id}: Has stops but no orders`);
        continue;
      }

      // Check order statuses
      const { data: orders } = await supabase
        .from('wms_orders')
        .select('order_id, order_no, status')
        .in('order_id', Array.from(orderIds));

      const processedStatuses = ['picked', 'loaded', 'in_transit', 'delivered'];
      const allProcessed = orders?.every(o => processedStatuses.includes(o.status));
      const someProcessed = orders?.some(o => processedStatuses.includes(o.status));

      if (allProcessed) {
        console.log(`   Trip ${trip.trip_id}: ✅ All orders processed (${orders?.length} orders)`);
      } else if (someProcessed) {
        console.log(`   Trip ${trip.trip_id}: ⚠️  Some orders processed`);
        const processed = orders?.filter(o => processedStatuses.includes(o.status));
        const pending = orders?.filter(o => !processedStatuses.includes(o.status));
        console.log(`      Processed: ${processed?.map(o => `${o.order_no}(${o.status})`).join(', ')}`);
        console.log(`      Pending: ${pending?.map(o => `${o.order_no}(${o.status})`).join(', ')}`);
        allTripsProcessed = false;
        hasValidTrip = true;
      } else {
        console.log(`   Trip ${trip.trip_id}: ✅ Ready for picklist (${orders?.length} orders)`);
        allTripsProcessed = false;
        hasValidTrip = true;
      }
    }

    if (!hasValidTrip) {
      console.log(`   ❌ Should NOT show: No valid trips`);
      issues.push({
        plan: plan.plan_code,
        issue: 'All trips empty or processed',
        shouldShow: false
      });
    } else {
      console.log(`   ✅ Should show: Has valid trips`);
    }
  }

  console.log('\n\n📊 Summary:');
  console.log(`Total approved plans: ${plans?.length || 0}`);
  console.log(`Plans that should NOT show: ${issues.length}`);
  
  if (issues.length > 0) {
    console.log('\n⚠️  Plans that should be filtered out:');
    issues.forEach(issue => {
      console.log(`   - ${issue.plan}: ${issue.issue}`);
    });
  } else {
    console.log('\n✅ All approved plans are valid for display');
  }
}

verifyFilter()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
