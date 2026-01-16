const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTripSequenceFix() {
  console.log('🧪 ทดสอบการแก้ไข trip_sequence เมื่อย้ายแผนข้ามวัน\n');

  // 1. ดูสถานะก่อนแก้ไข
  console.log('📊 สถานะก่อนแก้ไข:');
  const { data: plansBefore } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_date')
    .ilike('plan_code', 'RP-20260116%')
    .order('plan_code');

  for (const plan of plansBefore) {
    const { data: trips } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, trip_sequence')
      .eq('plan_id', plan.plan_id)
      .order('trip_sequence');

    console.log(`  ${plan.plan_code}: คันที่ ${trips.map(t => t.trip_sequence).join(', ')}`);
  }

  // 2. รัน migration
  console.log('\n🔧 กำลังรัน migration...');
  const fs = require('fs');
  const migrationSQL = fs.readFileSync('supabase/migrations/217_auto_resequence_trips_on_plan_date_change.sql', 'utf8');
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    if (error) {
      console.error('❌ Error running migration:', error);
      return;
    }
    console.log('✅ Migration รันสำเร็จ');
  } catch (err) {
    // ถ้าไม่มี exec_sql function ให้รันทีละคำสั่ง
    console.log('⚠️ ไม่สามารถรัน migration ผ่าน RPC ได้ กรุณารันด้วยตนเอง');
    console.log('   คำสั่ง: psql -h localhost -U postgres -d postgres -f supabase/migrations/217_auto_resequence_trips_on_plan_date_change.sql');
    return;
  }

  // 3. ทดสอบโดยการเปลี่ยน plan_date ของแผน RP-20260116-008 กลับไปวันที่ 15 แล้วกลับมาวันที่ 16
  console.log('\n🔄 ทดสอบการย้ายแผน RP-20260116-008...');
  
  const testPlan = plansBefore.find(p => p.plan_code === 'RP-20260116-008');
  if (!testPlan) {
    console.log('❌ ไม่พบแผน RP-20260116-008');
    return;
  }

  // ย้ายไปวันที่ 15 ก่อน
  console.log('  - ย้ายไปวันที่ 2026-01-15...');
  await supabase
    .from('receiving_route_plans')
    .update({ plan_date: '2026-01-15' })
    .eq('plan_id', testPlan.plan_id);

  // ย้ายกลับมาวันที่ 16
  console.log('  - ย้ายกลับมาวันที่ 2026-01-16...');
  await supabase
    .from('receiving_route_plans')
    .update({ plan_date: '2026-01-16' })
    .eq('plan_id', testPlan.plan_id);

  // 4. ดูสถานะหลังแก้ไข
  console.log('\n📊 สถานะหลังแก้ไข:');
  const { data: plansAfter } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_date')
    .ilike('plan_code', 'RP-20260116%')
    .order('plan_code');

  for (const plan of plansAfter) {
    const { data: trips } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, trip_sequence')
      .eq('plan_id', plan.plan_id)
      .order('trip_sequence');

    console.log(`  ${plan.plan_code}: คันที่ ${trips.map(t => t.trip_sequence).join(', ')}`);
  }

  // 5. ตรวจสอบว่า trip_sequence ต่อเนื่องกันหรือไม่
  console.log('\n✅ ตรวจสอบความต่อเนื่อง:');
  const { data: allTrips } = await supabase
    .from('receiving_route_trips')
    .select('trip_sequence, plan_id')
    .in('plan_id', plansAfter.map(p => p.plan_id))
    .order('trip_sequence');

  const sequences = allTrips.map(t => t.trip_sequence);
  const isSequential = sequences.every((seq, i) => i === 0 || seq === sequences[i - 1] + 1);
  
  if (isSequential) {
    console.log(`  ✅ trip_sequence ต่อเนื่องกัน: ${sequences[0]} ถึง ${sequences[sequences.length - 1]}`);
  } else {
    console.log(`  ⚠️ trip_sequence ไม่ต่อเนื่อง: ${sequences.join(', ')}`);
  }
}

testTripSequenceFix()
  .then(() => {
    console.log('\n✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
