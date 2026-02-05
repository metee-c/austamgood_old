require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissingDistance() {
  console.log('🔍 ตรวจสอบแผนงานและคันที่ไม่มีข้อมูลระยะทาง...\n');

  const planCodes = [
    'RP-20260130-005', 'RP-20260129-005', 'RP-20260129-001', 'RP-20260128-003',
    'RP-20260127-004', 'RP-20260126-005', 'RP-20260126-002', 'RP-20260124-003',
    'RP-20260123-007', 'RP-20260123-005', 'RP-20260119-001', 'RP-20260116-002',
    'RP-20260116-008', 'RP-20260114-001', 'RP-20260113-004', 'RP-20260109-003',
    'RP-20260108-001', 'RP-20260108-002', 'RP-20260107-002', 'RP-20260107-001'
  ];

  const tripNumbers = [6, 11, 5, 6, 5, 9, 7, 8, 3, 4, 13, 9, 2, 3, 11, 5, 6, 8, 4, 4, 10, 11, 12, 13, 14, 15, 10, 7];

  // ดึงข้อมูล route plans
  const { data: plans, error: plansError } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_date, status, total_distance_km')
    .in('plan_code', planCodes)
    .order('plan_code');

  if (plansError) {
    console.error('❌ Error fetching plans:', plansError);
    return;
  }

  console.log(`📋 พบแผนงาน ${plans.length} แผน\n`);

  for (const plan of plans) {
    console.log(`\n📦 แผน: ${plan.plan_code} (${plan.status})`);
    console.log(`   ระยะทางรวมของแผน: ${plan.total_distance_km || 'ไม่มีข้อมูล'} km`);

    // ดึงข้อมูล trips ของแผนนี้
    const { data: trips, error: tripsError } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, daily_trip_number, trip_sequence, total_distance_km, total_stops')
      .eq('plan_id', plan.plan_id)
      .order('daily_trip_number');

    if (tripsError) {
      console.error('   ❌ Error fetching trips:', tripsError);
      continue;
    }

    console.log(`   🚚 จำนวนคัน: ${trips.length} คัน`);

    for (const trip of trips) {
      const tripNum = trip.daily_trip_number || trip.trip_sequence;
      const hasDistance = trip.total_distance_km && trip.total_distance_km > 0;
      
      console.log(`      คันที่ ${tripNum}: ${hasDistance ? `${trip.total_distance_km.toFixed(1)} km` : '❌ ไม่มีข้อมูล'} (${trip.total_stops || 0} จุด)`);
    }
  }

  console.log('\n\n📊 สรุป:');
  console.log('ปัญหาที่พบ: แผนงานและคันบางคันไม่มีข้อมูล total_distance_km');
  console.log('\nสาเหตุที่เป็นไปได้:');
  console.log('1. แผนงานถูกสร้างแบบ manual (ไม่ผ่าน VRP optimization)');
  console.log('2. ข้อมูล stops ไม่มี coordinates (latitude/longitude)');
  console.log('3. การคำนวณระยะทางล้มเหลวตอนสร้างแผน');
  console.log('4. ข้อมูลถูกสร้างก่อนที่จะมีฟีเจอร์คำนวณระยะทาง');
}

checkMissingDistance().catch(console.error);
