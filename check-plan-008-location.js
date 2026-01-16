const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPlan008Location() {
  console.log('🔍 ตรวจสอบตำแหน่งของแผน RP-20260116-008\n');

  const { data: plan, error } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_date')
    .eq('plan_code', 'RP-20260116-008')
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📋 แผน: ${plan.plan_code}`);
  console.log(`   plan_id: ${plan.plan_id}`);
  console.log(`   plan_date: ${plan.plan_date}`);

  const { data: trips } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence')
    .eq('plan_id', plan.plan_id)
    .order('trip_sequence');

  console.log(`\n🚛 Trips:`);
  trips.forEach(t => {
    console.log(`   - คันที่ ${t.trip_sequence} (trip_id: ${t.trip_id})`);
  });
}

checkPlan008Location()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
