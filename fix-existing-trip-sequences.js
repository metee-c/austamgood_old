const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixExistingTripSequences() {
  console.log('🔧 แก้ไข trip_sequence ของข้อมูลที่มีอยู่แล้ว\n');

  // 1. ดึงวันที่ทั้งหมดที่มีแผน
  const { data: dates, error: datesError } = await supabase
    .from('receiving_route_plans')
    .select('plan_date')
    .not('plan_date', 'is', null)
    .order('plan_date');

  if (datesError) {
    console.error('❌ Error fetching dates:', datesError);
    return;
  }

  const uniqueDates = [...new Set(dates.map(d => d.plan_date))];
  console.log(`📅 พบ ${uniqueDates.length} วันที่มีแผน\n`);

  let totalUpdated = 0;

  // 2. Loop แต่ละวันที่
  for (const date of uniqueDates) {
    console.log(`\n📆 กำลังประมวลผลวันที่ ${date}...`);

    // ดึงแผนทั้งหมดของวันนี้
    const { data: plans, error: plansError } = await supabase
      .from('receiving_route_plans')
      .select('plan_id, plan_code')
      .eq('plan_date', date)
      .order('plan_code');

    if (plansError) {
      console.error(`  ❌ Error fetching plans:`, plansError);
      continue;
    }

    console.log(`  พบ ${plans.length} แผน`);

    let currentSequence = 0;

    // Loop แต่ละแผน
    for (const plan of plans) {
      // ดึง trips ของแผนนี้
      const { data: trips, error: tripsError } = await supabase
        .from('receiving_route_trips')
        .select('trip_id, trip_sequence')
        .eq('plan_id', plan.plan_id)
        .order('trip_sequence', { ascending: true, nullsFirst: false });

      if (tripsError) {
        console.error(`    ❌ Error fetching trips for ${plan.plan_code}:`, tripsError);
        continue;
      }

      if (trips.length === 0) {
        console.log(`    ${plan.plan_code}: ไม่มี trips`);
        continue;
      }

      const oldSequences = trips.map(t => t.trip_sequence);
      const newSequences = [];

      // อัปเดต trip_sequence ของแต่ละ trip
      for (const trip of trips) {
        currentSequence++;
        newSequences.push(currentSequence);

        const { error: updateError } = await supabase
          .from('receiving_route_trips')
          .update({ trip_sequence: currentSequence })
          .eq('trip_id', trip.trip_id);

        if (updateError) {
          console.error(`      ❌ Error updating trip ${trip.trip_id}:`, updateError);
        } else {
          totalUpdated++;
        }
      }

      const changed = oldSequences.join(',') !== newSequences.join(',');
      if (changed) {
        console.log(`    ${plan.plan_code}: ${oldSequences.join(', ')} → ${newSequences.join(', ')} ✅`);
      } else {
        console.log(`    ${plan.plan_code}: ${oldSequences.join(', ')} (ไม่เปลี่ยน)`);
      }
    }
  }

  console.log(`\n✅ เสร็จสิ้น! อัปเดต ${totalUpdated} trips`);
}

fixExistingTripSequences()
  .then(() => {
    console.log('\n🎉 สำเร็จ');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
