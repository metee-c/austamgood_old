const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPlanOrders() {
  console.log('🔍 ตรวจสอบ Orders ของ Plan 254 (RP-20260120-001)\n');
  console.log('='.repeat(70));

  const planId = 254;

  // 1. Check trips and stops
  const { data: trips } = await supabase
    .from('receiving_route_trips')
    .select(`
      trip_id,
      trip_code,
      trip_sequence,
      trip_status,
      receiving_route_stops!inner(
        stop_id,
        stop_sequence,
        order_id
      )
    `)
    .eq('plan_id', planId)
    .order('trip_sequence');

  console.log('\n🚚 Trips และ Stops:');
  
  if (trips && trips.length > 0) {
    for (const trip of trips) {
      const stops = trip.receiving_route_stops || [];
      console.log(`\n   Trip ${trip.trip_sequence}: ${trip.trip_code}`);
      console.log(`   - Status: ${trip.trip_status}`);
      console.log(`   - Stops: ${stops.length} รายการ`);
      
      if (stops.length > 0) {
        const orderIds = stops.map(s => s.order_id).filter(Boolean);
        console.log(`   - Order IDs: ${orderIds.join(', ')}`);
        
        // Get order details
        if (orderIds.length > 0) {
          const { data: orders } = await supabase
            .from('orders')
            .select('order_id, order_no, customer_name, route_plan_id, total_weight_kg')
            .in('order_id', orderIds);
          
          if (orders && orders.length > 0) {
            console.log(`   - Orders:`);
            orders.forEach(o => {
              console.log(`     * ${o.order_no}: ${o.customer_name} (Plan: ${o.route_plan_id || 'NULL'})`);
            });
          }
        }
      }
    }
  }

  // 2. Check orders with route_plan_id = 254
  console.log('\n📦 Orders ที่มี route_plan_id = 254:');
  const { data: ordersInPlan } = await supabase
    .from('orders')
    .select('order_id, order_no, customer_name, total_weight_kg')
    .eq('route_plan_id', planId);

  console.log(`   จำนวน: ${ordersInPlan?.length || 0} รายการ`);
  
  if (ordersInPlan && ordersInPlan.length > 0) {
    ordersInPlan.forEach(o => {
      console.log(`   - ${o.order_no}: ${o.customer_name}`);
    });
  }

  // 3. Check if orders exist but not linked to plan
  console.log('\n🔍 ตรวจสอบ Orders ที่อาจเคยอยู่ใน Plan 254:');
  
  // Check from stops
  const allStops = trips?.flatMap(t => t.receiving_route_stops || []) || [];
  const allOrderIds = [...new Set(allStops.map(s => s.order_id).filter(Boolean))];
  
  if (allOrderIds.length > 0) {
    const { data: ordersFromStops } = await supabase
      .from('orders')
      .select('order_id, order_no, customer_name, route_plan_id, order_status')
      .in('order_id', allOrderIds);
    
    console.log(`   Orders จาก Stops: ${ordersFromStops?.length || 0} รายการ`);
    
    if (ordersFromStops && ordersFromStops.length > 0) {
      ordersFromStops.forEach(o => {
        const planMatch = o.route_plan_id === planId ? '✅' : '❌';
        console.log(`   ${planMatch} ${o.order_no}: Plan=${o.route_plan_id}, Status=${o.order_status}`);
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 สรุป:');
  console.log('='.repeat(70));
  console.log(`Trips: ${trips?.length || 0} รายการ`);
  console.log(`Stops: ${allStops.length} รายการ`);
  console.log(`Orders ใน Stops: ${allOrderIds.length} รายการ`);
  console.log(`Orders ที่ route_plan_id = 254: ${ordersInPlan?.length || 0} รายการ`);
  
  if (allOrderIds.length > 0 && (!ordersInPlan || ordersInPlan.length === 0)) {
    console.log('\n⚠️  ปัญหา: มี orders ใน stops แต่ orders ไม่ได้ link กับ plan!');
    console.log('💡 แก้ไข: ต้อง update orders.route_plan_id = 254');
  } else if (allOrderIds.length === 0) {
    console.log('\n⚠️  ปัญหา: Trips ไม่มี stops หรือ stops ไม่มี orders!');
    console.log('💡 แก้ไข: ต้องสร้าง stops และ link orders เข้ากับ trips');
  } else {
    console.log('\n✅ Orders ถูก link กับ plan แล้ว พร้อมสร้าง picklists!');
  }
}

checkPlanOrders().catch(console.error);
