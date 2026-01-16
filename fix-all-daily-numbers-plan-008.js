require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixAllDailyNumbers() {
  console.log('🔧 Fixing all daily_trip_numbers in plan RP-20260116-008...\n');

  // Get plan_id for RP-20260116-008
  const { data: plan } = await supabase
    .from('receiving_route_plans')
    .select('plan_id')
    .eq('plan_code', 'RP-20260116-008')
    .single();

  if (!plan) {
    console.error('❌ Plan not found');
    return;
  }

  console.log('Plan ID:', plan.plan_id);
  console.log('');

  // Get all trips in this plan
  const { data: trips } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence, daily_trip_number')
    .eq('plan_id', plan.plan_id)
    .order('trip_sequence', { ascending: true });

  console.log('Before fix:');
  trips.forEach(t => {
    const mismatch = t.trip_sequence !== t.daily_trip_number ? ' ⚠️ MISMATCH' : '';
    console.log(`  Trip ${t.trip_id}: sequence=${t.trip_sequence}, daily_number=${t.daily_trip_number}${mismatch}`);
  });
  console.log('');

  // Fix each trip where daily_trip_number doesn't match trip_sequence
  let fixedCount = 0;
  for (const trip of trips) {
    if (trip.trip_sequence !== trip.daily_trip_number) {
      const { error } = await supabase
        .from('receiving_route_trips')
        .update({ daily_trip_number: trip.trip_sequence })
        .eq('trip_id', trip.trip_id);

      if (error) {
        console.error(`❌ Error updating trip ${trip.trip_id}:`, error);
      } else {
        console.log(`✅ Fixed trip ${trip.trip_id}: daily_number ${trip.daily_trip_number} → ${trip.trip_sequence}`);
        fixedCount++;
      }
    }
  }

  console.log('');
  console.log(`✅ Fixed ${fixedCount} trips`);
  console.log('');

  // Verify
  const { data: afterTrips } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence, daily_trip_number')
    .eq('plan_id', plan.plan_id)
    .order('trip_sequence', { ascending: true });

  console.log('After fix:');
  afterTrips.forEach(t => {
    const match = t.trip_sequence === t.daily_trip_number ? ' ✓' : ' ⚠️';
    console.log(`  Trip ${t.trip_id}: sequence=${t.trip_sequence}, daily_number=${t.daily_trip_number}${match}`);
  });
  console.log('');
  console.log('💡 Now all trips will display correctly in the print form!');
}

fixAllDailyNumbers().catch(console.error);
