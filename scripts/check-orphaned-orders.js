const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkOrphanedOrders() {
  console.log('🔍 ตรวจสอบ Orders ที่ค้าง route_plan_id\n');
  console.log('='.repeat(70));

  // 1. Check orders with route_plan_id that doesn't exist
  const { data: orphanedOrders } = await supabase
    .from('orders')
    .select(`
      order_id,
      order_no,
      customer_name,
      route_plan_id,
      order_status,
      delivery_date
    `)
    .not('route_plan_id', 'is', null)
    .order('order_id', { ascending: false })
    .limit(20);

  console.log(`\n📦 Orders ที่มี route_plan_id: ${orphanedOrders?.length || 0} รายการ (แสดง 20 รายการล่าสุด)\n`);

  if (orphanedOrders && orphanedOrders.length > 0) {
    // Check which plans exist
    const planIds = [...new Set(orphanedOrders.map(o => o.route_plan_id))];
    const { data: existingPlans } = await supabase
      .from('receiving_route_plans')
      .select('plan_id, plan_code, status')
      .in('plan_id', planIds);

    const existingPlanIds = new Set(existingPlans?.map(p => p.plan_id) || []);

    console.log('   รายการ Orders:');
    orphanedOrders.forEach(o => {
      const planExists = existingPlanIds.has(o.route_plan_id);
      const icon = planExists ? '✅' : '❌';
      const status = planExists ? 'Plan exists' : 'Plan DELETED';
      console.log(`   ${icon} ${o.order_no}: Plan ${o.route_plan_id} (${status}) - Status: ${o.order_status}`);
    });

    // Count orphaned
    const orphaned = orphanedOrders.filter(o => !existingPlanIds.has(o.route_plan_id));
    
    console.log(`\n⚠️  Orders ที่ค้าง (Plan ถูกลบแล้ว): ${orphaned.length} รายการ`);
    
    if (orphaned.length > 0) {
      console.log('\n💡 Orders เหล่านี้ต้อง reset route_plan_id = NULL เพื่อให้สามารถเลือกสร้างแผนใหม่ได้');
      console.log('\n   Order IDs ที่ต้อง reset:');
      orphaned.forEach(o => {
        console.log(`   - ${o.order_no} (ID: ${o.order_id})`);
      });
    }
  }

  // 2. Check orders available for new plan (route_plan_id IS NULL)
  const { data: availableOrders } = await supabase
    .from('orders')
    .select('order_id, order_no, customer_name, order_status, delivery_date')
    .is('route_plan_id', null)
    .in('order_status', ['confirmed', 'pending'])
    .order('delivery_date')
    .limit(10);

  console.log(`\n✅ Orders ที่พร้อมสร้างแผน (route_plan_id = NULL): ${availableOrders?.length || 0} รายการ\n`);
  
  if (availableOrders && availableOrders.length > 0) {
    availableOrders.forEach(o => {
      console.log(`   - ${o.order_no}: ${o.customer_name} (${o.order_status}) - ${o.delivery_date}`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 สรุป:');
  console.log('='.repeat(70));
  
  const orphanedCount = orphanedOrders?.filter(o => {
    const planIds = existingPlans?.map(p => p.plan_id) || [];
    return !planIds.includes(o.route_plan_id);
  }).length || 0;

  if (orphanedCount > 0) {
    console.log(`❌ มี ${orphanedCount} orders ที่ค้าง route_plan_id จาก plan ที่ถูกลบแล้ว`);
    console.log('💡 ต้อง reset route_plan_id = NULL เพื่อให้เลือกได้');
    console.log('\n🔧 วิธีแก้:');
    console.log('   UPDATE orders SET route_plan_id = NULL');
    console.log('   WHERE route_plan_id IN (254, ...)');
  } else {
    console.log(`✅ ไม่มี orphaned orders`);
  }
  
  console.log(`\n📦 Orders พร้อมสร้างแผน: ${availableOrders?.length || 0} รายการ`);
}

checkOrphanedOrders().catch(console.error);
