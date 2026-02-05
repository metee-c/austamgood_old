/**
 * สคริปต์ทดสอบ API /api/route-plans/[id]/trips
 * เพื่อยืนยันว่า total_distance_km ถูกส่งมาจาก API
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTripsAPI() {
  console.log('🔍 ทดสอบ API /api/route-plans/[id]/trips\n');

  // 1. หาแผนงานที่มีคันที่มีระยะทาง
  const { data: plans, error: plansError } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_date')
    .order('created_at', { ascending: false })
    .limit(5);

  if (plansError) {
    console.error('❌ Error fetching plans:', plansError);
    return;
  }

  console.log(`📋 พบ ${plans.length} แผนงาน\n`);

  for (const plan of plans) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📦 แผนงาน: ${plan.plan_code} (ID: ${plan.plan_id})`);
    console.log(`📅 วันที่: ${plan.plan_date}`);
    console.log(`${'='.repeat(80)}\n`);

    // 2. ดึงข้อมูลเที่ยวรถจากฐานข้อมูลโดยตรง
    const { data: dbTrips, error: dbError } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, trip_code, daily_trip_number, total_distance_km, total_stops')
      .eq('plan_id', plan.plan_id)
      .order('trip_sequence', { ascending: true });

    if (dbError) {
      console.error('❌ Error fetching trips from DB:', dbError);
      continue;
    }

    if (!dbTrips || dbTrips.length === 0) {
      console.log('⚠️  ไม่มีเที่ยวรถในแผนนี้\n');
      continue;
    }

    console.log('📊 ข้อมูลจากฐานข้อมูล:');
    console.log('─'.repeat(80));
    
    let hasZeroDistance = false;
    dbTrips.forEach((trip, idx) => {
      const distance = trip.total_distance_km || 0;
      const icon = distance === 0 ? '❌' : '✅';
      console.log(
        `${icon} คันที่ ${trip.daily_trip_number || idx + 1}: ` +
        `${distance.toFixed(2)} km (${trip.total_stops || 0} จุดส่ง)`
      );
      if (distance === 0) hasZeroDistance = true;
    });

    if (hasZeroDistance) {
      console.log('\n⚠️  พบคันที่มีระยะทาง 0 km - ต้องรันสคริปต์คำนวณระยะทาง');
    }

    console.log('\n');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ ทดสอบเสร็จสิ้น');
  console.log('='.repeat(80));
  console.log('\n📝 หมายเหตุ:');
  console.log('   - ถ้าข้อมูลในฐานข้อมูลถูกต้อง แต่ UI แสดงผิด = ปัญหา cache');
  console.log('   - แก้ไขแล้วโดยเพิ่ม force-dynamic และ cache headers ใน API');
  console.log('   - ลอง hard refresh (Ctrl+Shift+R) หรือ clear browser cache');
  console.log('   - หรือรอ 1-2 นาทีให้ Next.js revalidate');
}

testTripsAPI().catch(console.error);
