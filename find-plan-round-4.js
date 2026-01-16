const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findPlanRound4() {
  console.log('🔍 ค้นหาแผนวันที่ 15/01/2026\n');

  const { data: plans } = await supabase
    .from('receiving_route_plans')
    .select('plan_id, plan_code, plan_name, plan_date')
    .eq('plan_date', '2026-01-15')
    .order('plan_code');

  console.log(`📋 พบ ${plans.length} แผนวันที่ 15/01/2026:`);
  plans.forEach(p => {
    console.log(`  - ${p.plan_code}: ${p.plan_name}`);
  });

  // ถ้ามีแผนที่มี "รอบ 4" หรือ "004" ในชื่อ
  const round4Plans = plans.filter(p => 
    p.plan_name?.includes('รอบ 4') || 
    p.plan_name?.includes('004') ||
    p.plan_code?.includes('-004')
  );

  if (round4Plans.length > 0) {
    console.log(`\n✅ พบแผนรอบ 4:`);
    round4Plans.forEach(p => {
      console.log(`  - ${p.plan_code}: ${p.plan_name} (plan_id: ${p.plan_id})`);
    });
  } else {
    console.log(`\n⚠️ ไม่พบแผนที่มี "รอบ 4" ในชื่อ`);
    console.log(`   กรุณาระบุ plan_code หรือ plan_name ที่ถูกต้อง`);
  }
}

findPlanRound4()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
