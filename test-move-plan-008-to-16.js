const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMovePlan008() {
  console.log('🧪 ทดสอบการย้ายแผน RP-20260116-008 ไปวันที่ 16 จริงๆ\n');

  // 1. ดูสถานะก่อนย้าย
  console.log('📊 สถานะก่อนย้าย:');
  
  const { data: plan } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_date')
    .eq('plan_code', 'RP-20260116-008')
    .single();

  console.log(`  แผน: ${plan.plan_code}`);
  console.log(`  วันที่ปัจจุบัน: ${plan.plan_date}`);

  const { data: tripsBefore } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence')
    .eq('plan_id', plan.plan_id);

  console.log(`  trip_sequence ปัจจุบัน: ${tripsBefore.map(t => t.trip_sequence).join(', ')}`);

  // ดูแผนอื่นๆ ในวันที่ 16
  const { data: plans16Before } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code')
    .eq('plan_date', '2026-01-16')
    .order('plan_code');

  console.log(`\n  แผนอื่นๆ ในวันที่ 16 (ก่อนย้าย):`);
  for (const p of plans16Before) {
    const { data: trips } = await supabase
      .from('receiving_route_trips')
      .select('trip_sequence')
      .eq('plan_id', p.plan_id)
      .order('trip_sequence');
    console.log(`    ${p.plan_code}: คันที่ ${trips.map(t => t.trip_sequence).join(', ')}`);
  }

  // 2. ย้ายแผนไปวันที่ 16
  console.log(`\n🔄 กำลังย้ายแผน ${plan.plan_code} ไปวันที่ 2026-01-16...`);
  
  const { error } = await supabase
    .from('receiving_route_plans')
    .update({ plan_date: '2026-01-16' })
    .eq('plan_id', plan.plan_id);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ ย้ายสำเร็จ!');

  // 3. ดูสถานะหลังย้าย
  console.log('\n📊 สถานะหลังย้าย:');

  const { data: tripsAfter } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence')
    .eq('plan_id', plan.plan_id);

  console.log(`  trip_sequence ใหม่: ${tripsAfter.map(t => t.trip_sequence).join(', ')}`);

  // ดูแผนทั้งหมดในวันที่ 16
  const { data: plans16After } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code')
    .eq('plan_date', '2026-01-16')
    .order('plan_code');

  console.log(`\n  แผนทั้งหมดในวันที่ 16 (หลังย้าย):`);
  for (const p of plans16After) {
    const { data: trips } = await supabase
      .from('receiving_route_trips')
      .select('trip_sequence')
      .eq('plan_id', p.plan_id)
      .order('trip_sequence');
    
    const highlight = p.plan_code === plan.plan_code ? ' 👈 (แผนที่ย้าย)' : '';
    console.log(`    ${p.plan_code}: คันที่ ${trips.map(t => t.trip_sequence).join(', ')}${highlight}`);
  }

  // 4. ตรวจสอบความต่อเนื่อง
  console.log('\n✅ ตรวจสอบความต่อเนื่อง:');
  
  const { data: allTrips16 } = await supabase
    .from('receiving_route_trips')
    .select('trip_sequence')
    .in('plan_id', plans16After.map(p => p.plan_id))
    .order('trip_sequence');

  const sequences = allTrips16.map(t => t.trip_sequence);
  const uniqueSeq = [...new Set(sequences)].sort((a, b) => a - b);
  
  console.log(`  - จำนวน trips: ${allTrips16.length}`);
  console.log(`  - trip_sequence: ${uniqueSeq.join(', ')}`);
  
  const isSequential = uniqueSeq.every((seq, i) => i === 0 || seq === uniqueSeq[i - 1] + 1);
  
  if (isSequential) {
    console.log(`  ✅ ต่อเนื่องกัน (${uniqueSeq[0]} ถึง ${uniqueSeq[uniqueSeq.length - 1]})`);
  } else {
    console.log(`  ⚠️ ไม่ต่อเนื่อง มี gap`);
  }

  const hasDup = sequences.length !== uniqueSeq.length;
  if (hasDup) {
    console.log(`  ⚠️ มีเลขซ้ำกัน!`);
  } else {
    console.log(`  ✅ ไม่มีเลขซ้ำ`);
  }
}

testMovePlan008()
  .then(() => {
    console.log('\n🎉 เสร็จสิ้น');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
