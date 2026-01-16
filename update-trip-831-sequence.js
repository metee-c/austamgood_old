const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateTrip831Sequence() {
  console.log('🔧 อัปเดต trip_sequence ของ trip_id 831\n');

  // ดูข้อมูลปัจจุบัน
  const { data: tripBefore } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence, plan_id')
    .eq('trip_id', 831)
    .single();

  if (!tripBefore) {
    console.log('❌ ไม่พบ trip_id 831');
    return;
  }

  console.log('📊 ข้อมูลปัจจุบัน:');
  console.log(`  trip_id: ${tripBefore.trip_id}`);
  console.log(`  trip_sequence: ${tripBefore.trip_sequence}`);
  console.log(`  plan_id: ${tripBefore.plan_id}`);

  // หา trip_sequence สูงสุดของแผนนี้
  const { data: maxSeq } = await supabase
    .from('receiving_route_trips')
    .select('trip_sequence')
    .eq('plan_id', tripBefore.plan_id)
    .order('trip_sequence', { ascending: false })
    .limit(1)
    .single();

  const newSequence = (maxSeq?.trip_sequence || 0) + 1;

  console.log(`\n🔄 อัปเดต trip_sequence เป็น ${newSequence}...`);

  const { error } = await supabase
    .from('receiving_route_trips')
    .update({ trip_sequence: newSequence })
    .eq('trip_id', 831);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ อัปเดตสำเร็จ!');

  // ตรวจสอบผลลัพธ์
  const { data: tripAfter } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence')
    .eq('trip_id', 831)
    .single();

  console.log(`\n📊 ข้อมูลหลังอัปเดต:`);
  console.log(`  trip_id: ${tripAfter.trip_id}`);
  console.log(`  trip_sequence: ${tripAfter.trip_sequence}`);
}

updateTrip831Sequence()
  .then(() => {
    console.log('\n🎉 เสร็จสิ้น');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
