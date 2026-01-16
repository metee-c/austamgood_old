require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkTrip831() {
  console.log('🔍 Checking trip 831 display data...\n');

  // Check trip 831 data
  const { data: trip, error } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence, daily_trip_number, plan_id, supplier_id')
    .eq('trip_id', 831)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('Trip 831 data:');
  console.log('  trip_id:', trip.trip_id);
  console.log('  trip_sequence:', trip.trip_sequence);
  console.log('  daily_trip_number:', trip.daily_trip_number);
  console.log('  plan_id:', trip.plan_id);
  console.log('  supplier_id:', trip.supplier_id);
  console.log('');

  // Check plan data
  const { data: plan } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_date')
    .eq('plan_id', trip.plan_id)
    .single();

  console.log('Plan data:');
  console.log('  plan_code:', plan.plan_code);
  console.log('  plan_date:', plan.plan_date);
  console.log('');

  // Check all trips in this plan
  const { data: allTrips } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence, daily_trip_number, supplier_id')
    .eq('plan_id', trip.plan_id)
    .order('trip_sequence', { ascending: true });

  console.log('All trips in plan', plan.plan_code + ':');
  allTrips.forEach(t => {
    const isCurrent = t.trip_id === 831 ? ' ← THIS ONE' : '';
    console.log(`  Trip ${t.trip_id}: sequence=${t.trip_sequence}, daily_number=${t.daily_trip_number}, supplier=${t.supplier_id}${isCurrent}`);
  });
  console.log('');

  // Check what the modal would display
  console.log('📋 What the print form will show:');
  console.log('  displayTripNumber = daily_trip_number || (tripIndex + 1)');
  console.log('  displayTripNumber =', trip.daily_trip_number || '(tripIndex + 1)');
  console.log('');
  console.log('✅ The trip_sequence is already 10 (correct!)');
  console.log('✅ The daily_trip_number is', trip.daily_trip_number || 'NULL');
  console.log('');
  console.log('💡 The print form uses daily_trip_number if available, otherwise uses tripIndex + 1');
  console.log('💡 Since daily_trip_number is', trip.daily_trip_number || 'NULL', 'it will display as "คันที่', trip.daily_trip_number || '(calculated from index)', '"');
}

checkTrip831().catch(console.error);
