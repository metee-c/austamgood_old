const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function findIV27Orders() {
  console.log('🔍 ค้นหา Orders ที่ขึ้นต้นด้วย IV27\n');
  console.log('='.repeat(70));

  // Search for IV27 orders
  const { data: iv27Orders, error } = await supabase
    .from('wms_orders')
    .select('*')
    .ilike('order_no', 'IV27%')
    .order('order_no');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\n📦 พบ Orders ที่ขึ้นต้นด้วย IV27: ${iv27Orders?.length || 0} รายการ\n`);

  if (iv27Orders && iv27Orders.length > 0) {
    console.log('รายละเอียด Orders:');
    iv27Orders.forEach((o, i) => {
      console.log(`\n${i + 1}. ${o.order_no}`);
      console.log(`   - Customer: ${o.shop_name}`);
      console.log(`   - Status: ${o.status}`);
      console.log(`   - Matched Trip ID: ${o.matched_trip_id || 'NULL'}`);
      console.log(`   - Delivery Date: ${o.delivery_date}`);
      console.log(`   - Weight: ${o.total_weight} kg`);
      console.log(`   - Created: ${o.created_at}`);
    });

    // Check if they have matched_trip_id
    const withTrip = iv27Orders.filter(o => o.matched_trip_id !== null);
    const withoutTrip = iv27Orders.filter(o => o.matched_trip_id === null);

    console.log('\n' + '='.repeat(70));
    console.log('📊 สรุป:');
    console.log('='.repeat(70));
    console.log(`Total IV27 Orders: ${iv27Orders.length}`);
    console.log(`- มี matched_trip_id: ${withTrip.length} รายการ`);
    console.log(`- ไม่มี matched_trip_id (พร้อมสร้างแผน): ${withoutTrip.length} รายการ`);

    if (withTrip.length > 0) {
      console.log('\n⚠️  Orders ที่มี matched_trip_id:');
      withTrip.forEach(o => {
        console.log(`   - ${o.order_no}: Trip ${o.matched_trip_id}`);
      });

      // Check if those trips exist
      const tripIds = [...new Set(withTrip.map(o => o.matched_trip_id))];
      const { data: trips } = await supabase
        .from('receiving_route_trips')
        .select('trip_id, trip_code, status, plan_id')
        .in('trip_id', tripIds);

      const existingTripIds = new Set(trips?.map(t => t.trip_id) || []);
      const orphaned = withTrip.filter(o => !existingTripIds.has(o.matched_trip_id));

      if (orphaned.length > 0) {
        console.log('\n❌ Orders ที่ค้าง matched_trip_id (Trip ถูกลบแล้ว):');
        orphaned.forEach(o => {
          console.log(`   - ${o.order_no}: Trip ${o.matched_trip_id} (DELETED)`);
        });
        console.log('\n💡 ต้อง reset matched_trip_id = NULL เพื่อให้เลือกได้');
      }
    }

    if (withoutTrip.length > 0) {
      console.log('\n✅ Orders พร้อมสร้าง Route Plan:');
      withoutTrip.forEach(o => {
        console.log(`   - ${o.order_no}: ${o.shop_name}`);
      });
    }
  } else {
    console.log('❌ ไม่พบ Orders ที่ขึ้นต้นด้วย IV27');
    console.log('\n💡 Orders เหล่านี้อาจถูกลบไปแล้วตอนลบ Route Plans');
    console.log('   ต้อง import orders ใหม่อีกครั้ง');
  }
}

findIV27Orders().catch(console.error);
