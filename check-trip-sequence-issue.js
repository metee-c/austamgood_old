const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTripSequenceIssue() {
  console.log('🔍 ตรวจสอบปัญหา trip_sequence เมื่อย้ายแผนข้ามวัน\n');

  // 1. ดูแผนวันที่ 16
  const { data: plans16, error: plansError } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_date')
    .ilike('plan_code', 'RP-20260116%')
    .order('plan_code');

  if (plansError) {
    console.error('Error:', plansError);
    return;
  }

  console.log('📋 แผนทั้งหมดวันที่ 16 มกราคม 2026:');
  plans16.forEach(p => {
    console.log(`  - ${p.plan_code} (plan_id: ${p.plan_id})`);
  });

  // 2. ดู trips ของแต่ละแผน
  console.log('\n🚛 Trips ในแต่ละแผน:');
  for (const plan of plans16) {
    const { data: trips, error: tripsError } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, trip_code, trip_sequence, plan_id')
      .eq('plan_id', plan.plan_id)
      .order('trip_sequence');

    if (tripsError) {
      console.error(`Error fetching trips for ${plan.plan_code}:`, tripsError);
      continue;
    }

    console.log(`\n  ${plan.plan_code}:`);
    if (trips.length === 0) {
      console.log('    (ไม่มี trips)');
    } else {
      trips.forEach(t => {
        console.log(`    - คันที่ ${t.trip_sequence} (trip_id: ${t.trip_id}, trip_code: ${t.trip_code})`);
      });
    }
  }

  // 3. หา trip_sequence สูงสุดของวันที่ 16
  console.log('\n📊 สรุป trip_sequence ของวันที่ 16:');
  const { data: allTrips16, error: allTripsError } = await supabase
    .from('receiving_route_trips')
    .select('trip_sequence, trip_code, plan_id')
    .in('plan_id', plans16.map(p => p.plan_id))
    .order('trip_sequence', { ascending: false });

  if (allTripsError) {
    console.error('Error:', allTripsError);
    return;
  }

  if (allTrips16.length > 0) {
    console.log(`  - trip_sequence ต่ำสุด: ${allTrips16[allTrips16.length - 1].trip_sequence}`);
    console.log(`  - trip_sequence สูงสุด: ${allTrips16[0].trip_sequence}`);
    console.log(`  - จำนวน trips ทั้งหมด: ${allTrips16.length}`);
  } else {
    console.log('  - ไม่มี trips');
  }

  // 4. ตรวจสอบว่ามี gap ใน trip_sequence หรือไม่
  console.log('\n🔢 ตรวจสอบ gap ใน trip_sequence:');
  const sequences = allTrips16.map(t => t.trip_sequence).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 0; i < sequences.length - 1; i++) {
    if (sequences[i + 1] - sequences[i] > 1) {
      gaps.push({ from: sequences[i], to: sequences[i + 1] });
    }
  }

  if (gaps.length > 0) {
    console.log('  ⚠️ พบ gap:');
    gaps.forEach(g => {
      console.log(`    - ระหว่าง ${g.from} และ ${g.to}`);
    });
  } else {
    console.log('  ✅ ไม่มี gap (ต่อเนื่อง)');
  }

  // 5. แสดงแผนที่ถูกย้ายมา (RP-20260116-008)
  const movedPlan = plans16.find(p => p.plan_code === 'RP-20260116-008');
  if (movedPlan) {
    console.log('\n🔄 แผนที่ถูกย้ายมา (RP-20260116-008):');
    const { data: movedTrips } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, trip_sequence, trip_code')
      .eq('plan_id', movedPlan.plan_id)
      .order('trip_sequence');

    if (movedTrips && movedTrips.length > 0) {
      console.log('  Trips:');
      movedTrips.forEach(t => {
        console.log(`    - คันที่ ${t.trip_sequence} (${t.trip_code})`);
      });
    }
  }
}

checkTripSequenceIssue()
  .then(() => {
    console.log('\n✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
