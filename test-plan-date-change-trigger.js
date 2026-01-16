const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPlanDateChangeTrigger() {
  console.log('🧪 ทดสอบ Trigger: auto_resequence_trips_on_plan_date_change\n');

  // 1. ดูสถานะก่อนทดสอบ
  console.log('📊 สถานะก่อนทดสอบ (วันที่ 16):');
  const { data: plansBefore } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_date')
    .eq('plan_date', '2026-01-16')
    .order('plan_code');

  for (const plan of plansBefore) {
    const { data: trips } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, trip_sequence')
      .eq('plan_id', plan.plan_id)
      .order('trip_sequence');

    const sequences = trips.map(t => t.trip_sequence).join(', ');
    console.log(`  ${plan.plan_code}: คันที่ ${sequences || '(ไม่มี trips)'}`);
  }

  // 2. หาแผน RP-20260116-008 เพื่อทดสอบ
  const testPlan = plansBefore.find(p => p.plan_code === 'RP-20260116-008');
  if (!testPlan) {
    console.log('\n❌ ไม่พบแผน RP-20260116-008 สำหรับทดสอบ');
    return;
  }

  console.log(`\n🔄 ทดสอบการย้ายแผน ${testPlan.plan_code} (plan_id: ${testPlan.plan_id})`);

  // 3. ย้ายไปวันที่ 15 ก่อน
  console.log('\n  [1] ย้ายไปวันที่ 2026-01-15...');
  const { error: moveError1 } = await supabase
    .from('receiving_route_plans')
    .update({ plan_date: '2026-01-15' })
    .eq('plan_id', testPlan.plan_id);

  if (moveError1) {
    console.error('  ❌ Error:', moveError1);
    return;
  }
  console.log('  ✅ ย้ายสำเร็จ');

  // ดู trip_sequence หลังย้ายไปวันที่ 15
  const { data: tripsOn15 } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence')
    .eq('plan_id', testPlan.plan_id)
    .order('trip_sequence');

  console.log(`  📊 trip_sequence หลังย้ายไปวันที่ 15: ${tripsOn15.map(t => t.trip_sequence).join(', ')}`);

  // 4. ย้ายกลับมาวันที่ 16
  console.log('\n  [2] ย้ายกลับมาวันที่ 2026-01-16...');
  const { error: moveError2 } = await supabase
    .from('receiving_route_plans')
    .update({ plan_date: '2026-01-16' })
    .eq('plan_id', testPlan.plan_id);

  if (moveError2) {
    console.error('  ❌ Error:', moveError2);
    return;
  }
  console.log('  ✅ ย้ายสำเร็จ');

  // 5. ดูสถานะหลังทดสอบ
  console.log('\n📊 สถานะหลังทดสอบ (วันที่ 16):');
  const { data: plansAfter } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_date')
    .eq('plan_date', '2026-01-16')
    .order('plan_code');

  for (const plan of plansAfter) {
    const { data: trips } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, trip_sequence')
      .eq('plan_id', plan.plan_id)
      .order('trip_sequence');

    const sequences = trips.map(t => t.trip_sequence).join(', ');
    const highlight = plan.plan_code === testPlan.plan_code ? ' 👈 (แผนที่ทดสอบ)' : '';
    console.log(`  ${plan.plan_code}: คันที่ ${sequences || '(ไม่มี trips)'}${highlight}`);
  }

  // 6. ตรวจสอบความต่อเนื่อง
  console.log('\n✅ ตรวจสอบความต่อเนื่องของ trip_sequence:');
  const { data: allTrips } = await supabase
    .from('receiving_route_trips')
    .select('trip_sequence, plan_id')
    .in('plan_id', plansAfter.map(p => p.plan_id))
    .order('trip_sequence');

  const sequences = allTrips.map(t => t.trip_sequence);
  const uniqueSequences = [...new Set(sequences)].sort((a, b) => a - b);
  
  console.log(`  - จำนวน trips ทั้งหมด: ${allTrips.length}`);
  console.log(`  - trip_sequence ที่ใช้: ${uniqueSequences.join(', ')}`);
  
  // ตรวจสอบว่าต่อเนื่องหรือไม่
  const isSequential = uniqueSequences.every((seq, i) => 
    i === 0 || seq === uniqueSequences[i - 1] + 1
  );
  
  if (isSequential) {
    console.log(`  ✅ trip_sequence ต่อเนื่องกัน (${uniqueSequences[0]} ถึง ${uniqueSequences[uniqueSequences.length - 1]})`);
  } else {
    console.log(`  ⚠️ trip_sequence ไม่ต่อเนื่อง มี gap อยู่`);
  }

  // ตรวจสอบว่ามีเลขซ้ำหรือไม่
  const hasDuplicates = sequences.length !== uniqueSequences.length;
  if (hasDuplicates) {
    console.log(`  ⚠️ มี trip_sequence ซ้ำกัน!`);
    const duplicates = sequences.filter((seq, i) => sequences.indexOf(seq) !== i);
    console.log(`     เลขที่ซ้ำ: ${[...new Set(duplicates)].join(', ')}`);
  } else {
    console.log(`  ✅ ไม่มี trip_sequence ซ้ำกัน`);
  }

  console.log('\n🎉 ทดสอบเสร็จสิ้น!');
}

testPlanDateChangeTrigger()
  .then(() => {
    console.log('\n✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
