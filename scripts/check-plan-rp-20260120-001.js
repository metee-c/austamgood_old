const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPlan() {
  console.log('🔍 ตรวจสอบ Route Plan: RP-20260120-001\n');
  console.log('='.repeat(70));

  // 1. Check plan exists
  const { data: plan } = await supabase
    .from('receiving_route_plans')
    .select('*')
    .eq('plan_code', 'RP-20260120-001')
    .single();

  if (!plan) {
    console.log('❌ ไม่พบ Route Plan: RP-20260120-001');
    return;
  }

  console.log('\n📋 Route Plan:');
  console.log(`   Plan ID: ${plan.plan_id}`);
  console.log(`   Plan Code: ${plan.plan_code}`);
  console.log(`   Plan Date: ${plan.plan_date}`);
  console.log(`   Status: ${plan.status}`);

  // 2. Check trips
  const { data: trips } = await supabase
    .from('receiving_route_trips')
    .select('*')
    .eq('plan_id', plan.plan_id)
    .order('trip_sequence');

  console.log(`\n🚚 Trips: ${trips?.length || 0} รายการ`);
  
  if (trips && trips.length > 0) {
    trips.forEach(t => {
      console.log(`   - Trip ${t.trip_sequence}: ${t.trip_code} (${t.trip_status})`);
    });
  } else {
    console.log('   ⚠️  ไม่มี trips ในแผนนี้!');
  }

  // 3. Check orders in plan
  const { data: orders } = await supabase
    .from('orders')
    .select('order_id, order_no, customer_name, total_weight_kg')
    .eq('route_plan_id', plan.plan_id);

  console.log(`\n📦 Orders: ${orders?.length || 0} รายการ`);
  
  if (orders && orders.length > 0) {
    const totalWeight = orders.reduce((sum, o) => sum + (o.total_weight_kg || 0), 0);
    console.log(`   น้ำหนักรวม: ${totalWeight.toFixed(2)} kg`);
    console.log('\n   รายการ Orders:');
    orders.slice(0, 5).forEach(o => {
      console.log(`   - ${o.order_no}: ${o.customer_name} (${o.total_weight_kg} kg)`);
    });
    if (orders.length > 5) {
      console.log(`   ... และอีก ${orders.length - 5} รายการ`);
    }
  }

  // 4. Check picklists
  const { data: picklists } = await supabase
    .from('picklists')
    .select('id, picklist_code, status')
    .eq('route_plan_id', plan.plan_id);

  console.log(`\n📝 Picklists: ${picklists?.length || 0} รายการ`);
  
  if (picklists && picklists.length > 0) {
    picklists.forEach(p => {
      console.log(`   - ${p.picklist_code}: ${p.status}`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 สรุป:');
  console.log('='.repeat(70));
  
  if (!trips || trips.length === 0) {
    console.log('❌ ไม่มี trips ในแผนนี้');
    console.log('💡 ต้องสร้าง trips ใหม่จาก orders');
    console.log('\n🎯 วิธีแก้:');
    console.log('   1. ใช้ Optimize API เพื่อสร้าง trips จาก orders');
    console.log('   2. หรือสร้าง trips ด้วยตนเองจาก orders ที่มี');
  } else {
    console.log(`✅ มี ${trips.length} trips พร้อมสร้าง picklists`);
  }
}

checkPlan().catch(console.error);
