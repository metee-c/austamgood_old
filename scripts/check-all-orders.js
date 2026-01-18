const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAllOrders() {
  console.log('🔍 ตรวจสอบ Orders ทั้งหมดในระบบ\n');
  console.log('='.repeat(70));

  // 1. Count all orders
  const { count: totalCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📦 Orders ทั้งหมด: ${totalCount || 0} รายการ`);

  if (totalCount === 0) {
    console.log('\n❌ ไม่มี orders ในระบบเลย!');
    console.log('💡 ต้องสร้าง orders ก่อนจึงจะสร้าง route plan ได้');
    return;
  }

  // 2. Group by status
  const { data: byStatus } = await supabase
    .from('orders')
    .select('order_status')
    .order('order_status');

  const statusCounts = {};
  byStatus?.forEach(o => {
    statusCounts[o.order_status] = (statusCounts[o.order_status] || 0) + 1;
  });

  console.log('\n📊 แยกตาม Status:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count} รายการ`);
  });

  // 3. Check recent orders
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('order_id, order_no, customer_name, order_status, route_plan_id, delivery_date, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n📋 Orders ล่าสุด (10 รายการ):');
  recentOrders?.forEach(o => {
    const planStatus = o.route_plan_id ? `Plan: ${o.route_plan_id}` : 'No Plan';
    console.log(`   - ${o.order_no}: ${o.customer_name}`);
    console.log(`     Status: ${o.order_status}, ${planStatus}, Delivery: ${o.delivery_date}`);
  });

  // 4. Check orders suitable for route planning
  const { data: suitableOrders } = await supabase
    .from('orders')
    .select('order_id, order_no, customer_name, order_status, delivery_date')
    .is('route_plan_id', null)
    .order('delivery_date');

  console.log(`\n✅ Orders ที่สามารถสร้าง Route Plan ได้: ${suitableOrders?.length || 0} รายการ`);
  
  if (suitableOrders && suitableOrders.length > 0) {
    console.log('\n   Status breakdown:');
    const suitableByStatus = {};
    suitableOrders.forEach(o => {
      suitableByStatus[o.order_status] = (suitableByStatus[o.order_status] || 0) + 1;
    });
    Object.entries(suitableByStatus).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} รายการ`);
    });

    console.log('\n   ตัวอย่าง Orders:');
    suitableOrders.slice(0, 5).forEach(o => {
      console.log(`   - ${o.order_no}: ${o.customer_name} (${o.order_status})`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 สรุป:');
  console.log('='.repeat(70));
  console.log(`Total Orders: ${totalCount}`);
  console.log(`Orders พร้อมสร้าง Plan: ${suitableOrders?.length || 0}`);
  
  if ((suitableOrders?.length || 0) === 0) {
    console.log('\n⚠️  ไม่มี orders ที่พร้อมสร้าง route plan!');
    console.log('\n💡 เหตุผลที่เป็นไปได้:');
    console.log('   1. Orders ทั้งหมดมี route_plan_id แล้ว');
    console.log('   2. Orders มี status ไม่เหมาะสม (ต้องเป็น confirmed/pending)');
    console.log('   3. ไม่มี orders ในระบบ');
  }
}

checkAllOrders().catch(console.error);
