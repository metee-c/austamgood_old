const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEmptyTrip9() {
  console.log('🔍 ตรวจสอบคันที่ 9 ที่ว่างเปล่า\n');

  // หาแผนวันที่ 15/01/2026 รอบ 4
  const { data: plans } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_name')
    .eq('plan_date', '2026-01-15')
    .ilike('plan_name', '%รอบ 4%');

  if (!plans || plans.length === 0) {
    console.log('❌ ไม่พบแผนวันที่ 15/01/2026 รอบ 4');
    return;
  }

  console.log(`📋 พบแผน: ${plans[0].plan_code} - ${plans[0].plan_name}\n`);

  // หา trips ทั้งหมดของแผนนี้
  const { data: trips } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence, trip_code')
    .eq('plan_id', plans[0].plan_id)
    .order('trip_sequence');

  console.log(`🚛 Trips ทั้งหมด (${trips.length} คัน):`);
  
  for (const trip of trips) {
    // นับ stops
    const { data: stops, count: stopsCount } = await supabase
      .from('receiving_route_stops')
      .select('stop_id', { count: 'exact' })
      .eq('trip_id', trip.trip_id);

    const isEmpty = !stops || stops.length === 0;
    const status = isEmpty ? '⚠️ ว่างเปล่า' : `✅ มี ${stops.length} stops`;
    
    console.log(`  คันที่ ${trip.trip_sequence} (trip_id: ${trip.trip_id}): ${status}`);

    if (isEmpty) {
      console.log(`    👉 trip นี้ควรถูกลบออก!`);
    }
  }

  // แนะนำวิธีแก้ไข
  const emptyTrips = [];
  for (const trip of trips) {
    const { data: stops } = await supabase
      .from('receiving_route_stops')
      .select('stop_id')
      .eq('trip_id', trip.trip_id);
    
    if (!stops || stops.length === 0) {
      emptyTrips.push(trip);
    }
  }

  if (emptyTrips.length > 0) {
    console.log(`\n🔧 พบ ${emptyTrips.length} trips ว่างเปล่า:`);
    emptyTrips.forEach(t => {
      console.log(`  - คันที่ ${t.trip_sequence} (trip_id: ${t.trip_id})`);
    });

    console.log(`\n💡 วิธีแก้ไข: รัน script ลบ trips ว่างเปล่า`);
  } else {
    console.log(`\n✅ ไม่มี trips ว่างเปล่า`);
  }
}

checkEmptyTrip9()
  .then(() => {
    console.log('\n✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
