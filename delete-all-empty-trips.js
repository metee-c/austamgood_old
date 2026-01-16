const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAllEmptyTrips() {
  console.log('🔍 ค้นหาและลบ trips ว่างเปล่าทั้งหมด\n');

  // ดึง trips ทั้งหมด
  const { data: allTrips } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence, plan_id')
    .order('plan_id', { ascending: true });

  console.log(`📊 พบ ${allTrips.length} trips ทั้งหมด`);
  console.log(`🔍 กำลังตรวจสอบ trips ว่างเปล่า...\n`);

  const emptyTrips = [];

  for (const trip of allTrips) {
    const { data: stops, count } = await supabase
      .from('receiving_route_stops')
      .select('stop_id', { count: 'exact' })
      .eq('trip_id', trip.trip_id);

    if (!stops || stops.length === 0) {
      emptyTrips.push(trip);
    }
  }

  console.log(`⚠️  พบ ${emptyTrips.length} trips ว่างเปล่า\n`);

  if (emptyTrips.length === 0) {
    console.log('✅ ไม่มี trips ว่างเปล่า');
    return;
  }

  // แสดงรายละเอียด trips ว่างเปล่า
  console.log('📋 รายการ trips ว่างเปล่า:');
  
  const tripsByPlan = {};
  for (const trip of emptyTrips) {
    if (!tripsByPlan[trip.plan_id]) {
      tripsByPlan[trip.plan_id] = [];
    }
    tripsByPlan[trip.plan_id].push(trip);
  }

  for (const [planId, trips] of Object.entries(tripsByPlan)) {
    const { data: plan } = await supabase
      .from('receiving_route_plans')
      .select('plan_code, plan_name')
      .eq('plan_id', planId)
      .single();

    console.log(`\n  ${plan.plan_code} - ${plan.plan_name}:`);
    trips.forEach(t => {
      console.log(`    - คันที่ ${t.trip_sequence} (trip_id: ${t.trip_id})`);
    });
  }

  // ถามยืนยันก่อนลบ
  console.log(`\n🗑️  กำลังลบ ${emptyTrips.length} trips ว่างเปล่า...`);

  let deletedCount = 0;
  let errorCount = 0;

  for (const trip of emptyTrips) {
    const { error } = await supabase
      .from('receiving_route_trips')
      .delete()
      .eq('trip_id', trip.trip_id);

    if (error) {
      console.error(`  ❌ ลบ trip_id ${trip.trip_id} ไม่สำเร็จ:`, error.message);
      errorCount++;
    } else {
      deletedCount++;
    }
  }

  console.log(`\n✅ สรุป:`);
  console.log(`  - ลบสำเร็จ: ${deletedCount} trips`);
  if (errorCount > 0) {
    console.log(`  - ลบไม่สำเร็จ: ${errorCount} trips`);
  }
}

deleteAllEmptyTrips()
  .then(() => {
    console.log('\n🎉 เสร็จสิ้น');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
