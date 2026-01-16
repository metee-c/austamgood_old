require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixTrip831DailyNumber() {
  console.log('🔧 Fixing trip 831 daily_trip_number...\n');

  // Check current value
  const { data: before } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence, daily_trip_number')
    .eq('trip_id', 831)
    .single();

  console.log('Before:');
  console.log('  trip_sequence:', before.trip_sequence);
  console.log('  daily_trip_number:', before.daily_trip_number);
  console.log('');

  // Update daily_trip_number to match trip_sequence
  const { data: updated, error } = await supabase
    .from('receiving_route_trips')
    .update({ daily_trip_number: 10 })
    .eq('trip_id', 831)
    .select()
    .single();

  if (error) {
    console.error('❌ Error updating:', error);
    return;
  }

  console.log('After update:');
  console.log('  trip_sequence:', updated.trip_sequence);
  console.log('  daily_trip_number:', updated.daily_trip_number);
  console.log('');
  console.log('✅ Updated trip 831: daily_trip_number changed from 9 to 10');
  console.log('');
  console.log('💡 Now the print form will show "คันที่ 10" correctly!');
}

fixTrip831DailyNumber().catch(console.error);
