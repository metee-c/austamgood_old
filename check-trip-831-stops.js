require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkTrip831Stops() {
  console.log('🔍 Checking trip 831 stops and orders...\n');

  // Check trip 831 basic info
  const { data: trip } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence, daily_trip_number, total_stops, plan_id')
    .eq('trip_id', 831)
    .single();

  console.log('Trip 831 info:');
  console.log('  trip_id:', trip.trip_id);
  console.log('  trip_sequence:', trip.trip_sequence);
  console.log('  daily_trip_number:', trip.daily_trip_number);
  console.log('  total_stops:', trip.total_stops);
  console.log('');

  // Check stops for this trip
  const { data: stops } = await supabase
    .from('receiving_route_stops')
    .select('stop_id, sequence_no, stop_name, order_id')
    .eq('trip_id', 831)
    .order('sequence_no', { ascending: true });

  console.log('Stops in trip 831:', stops?.length || 0);
  if (stops && stops.length > 0) {
    stops.forEach(s => {
      console.log(`  Stop ${s.stop_id}: seq=${s.sequence_no}, name=${s.stop_name}, order_id=${s.order_id}`);
    });
  } else {
    console.log('  ❌ No stops found!');
  }
  console.log('');

  // Check if there are any orders linked to this trip
  const { data: orders } = await supabase
    .from('wms_orders')
    .select('order_id, order_no, customer_id')
    .eq('trip_id', 831);

  console.log('Orders linked to trip 831:', orders?.length || 0);
  if (orders && orders.length > 0) {
    orders.forEach(o => {
      console.log(`  Order ${o.order_id}: ${o.order_no}, customer=${o.customer_id}`);
    });
  } else {
    console.log('  ❌ No orders found!');
  }
  console.log('');

  console.log('💡 Summary:');
  console.log('  - Trip 831 has', stops?.length || 0, 'stops');
  console.log('  - Trip 831 has', orders?.length || 0, 'orders');
  console.log('');
  
  if ((stops?.length || 0) === 0 && (orders?.length || 0) === 0) {
    console.log('⚠️  This is an EMPTY trip - should NOT appear in print form!');
    console.log('');
    console.log('🔧 Solution: Filter out trips with no stops in TransportContractModal');
  }
}

checkTrip831Stops().catch(console.error);
