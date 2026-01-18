/**
 * สร้าง stops สำหรับแผน 251 จากข้อมูลออเดอร์
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function createStops() {
  console.log('\n🔍 กำลังสร้าง stops สำหรับแผน 251...\n');

  // 1. ดึงข้อมูล trips
  const { data: trips, error: tripsError } = await supabase
    .from('receiving_route_trips')
    .select('*')
    .eq('plan_id', 251)
    .order('trip_sequence', { ascending: true });

  if (tripsError || !trips || trips.length === 0) {
    console.error('❌ ไม่พบ trips:', tripsError?.message);
    return;
  }

  console.log(`✅ พบ ${trips.length} trips\n`);

  // 2. ดึงข้อมูลออเดอร์ IV27
  const { data: orders, error: ordersError } = await supabase
    .from('wms_orders')
    .select('*')
    .like('order_no', 'IV27%')
    .eq('status', 'draft')
    .order('order_id', { ascending: true });

  if (ordersError || !orders || orders.length === 0) {
    console.error('❌ ไม่พบออเดอร์:', ordersError?.message);
    return;
  }

  console.log(`✅ พบ ${orders.length} ออเดอร์\n`);

  // ดึงข้อมูลลูกค้า
  const customerIds = [...new Set(orders.map(o => o.customer_id))];
  const { data: customers, error: customersError } = await supabase
    .from('master_customer')
    .select('*')
    .in('customer_id', customerIds);

  if (customersError || !customers) {
    console.error('❌ ไม่พบข้อมูลลูกค้า:', customersError?.message);
    return;
  }

  const customerMap = {};
  customers.forEach(c => {
    customerMap[c.customer_id] = c;
  });

  // 3. แบ่งออเดอร์ตาม province
  const bangkokOrders = orders.filter(o => o.province === 'กรุงเทพฯ');
  const nonthaburiOrders = orders.filter(o => o.province === 'นนทบุรี');

  console.log(`   - กรุงเทพฯ: ${bangkokOrders.length} ออเดอร์`);
  console.log(`   - นนทบุรี: ${nonthaburiOrders.length} ออเดอร์\n`);

  // 4. สร้าง stops
  const stopsToCreate = [];

  // Trip 1 (trip_sequence=1) -> กรุงเทพฯ
  if (trips[0] && bangkokOrders.length > 0) {
    const customer = customerMap[bangkokOrders[0].customer_id];
    const orderIds = bangkokOrders.map(o => o.order_id);
    const totalWeight = bangkokOrders.reduce((sum, o) => sum + (parseFloat(o.total_weight) || 0), 0);

    stopsToCreate.push({
      trip_id: trips[0].trip_id,
      plan_id: 251,
      sequence_no: 1,
      stop_type: 'dropoff',
      status: 'pending',
      stop_name: customer.customer_name,
      latitude: customer.latitude,
      longitude: customer.longitude,
      address: `${customer.customer_name}, ${bangkokOrders[0].province}`,
      customer_id: customer.customer_id,
      order_id: orderIds[0],
      load_weight_kg: totalWeight,
      load_volume_cbm: 40.9,
      load_pallets: 5.4625,
      load_units: 994,
      service_duration_minutes: 17,
      travel_minutes_from_prev: 31,
      tags: {
        order_ids: orderIds,
        order_count: orderIds.length
      }
    });

    console.log(`✅ สร้าง stop สำหรับ Trip 1: ${customer.customer_name} (${orderIds.length} ออเดอร์)`);
  }

  // Trip 2 (trip_sequence=2) -> นนทบุรี
  if (trips[1] && nonthaburiOrders.length > 0) {
    const customer = customerMap[nonthaburiOrders[0].customer_id];
    const orderIds = nonthaburiOrders.map(o => o.order_id);
    const totalWeight = nonthaburiOrders.reduce((sum, o) => sum + (parseFloat(o.total_weight) || 0), 0);

    stopsToCreate.push({
      trip_id: trips[1].trip_id,
      plan_id: 251,
      sequence_no: 1,
      stop_type: 'dropoff',
      status: 'pending',
      stop_name: customer.customer_name,
      latitude: customer.latitude,
      longitude: customer.longitude,
      address: `${customer.customer_name}, ${nonthaburiOrders[0].province}`,
      customer_id: customer.customer_id,
      order_id: orderIds[0],
      load_weight_kg: totalWeight,
      load_volume_cbm: 12.8,
      load_pallets: 2.29,
      load_units: 1068,
      service_duration_minutes: 17,
      travel_minutes_from_prev: 31,
      tags: {
        order_ids: orderIds,
        order_count: orderIds.length
      }
    });

    console.log(`✅ สร้าง stop สำหรับ Trip 2: ${customer.customer_name} (${orderIds.length} ออเดอร์)`);
  }

  // 5. บันทึก stops
  if (stopsToCreate.length > 0) {
    console.log(`\n💾 กำลังบันทึก ${stopsToCreate.length} stops...\n`);

    const { data: insertedStops, error: insertError } = await supabase
      .from('receiving_route_stops')
      .insert(stopsToCreate)
      .select();

    if (insertError) {
      console.error('❌ บันทึก stops ไม่สำเร็จ:', insertError.message);
      console.error('   Details:', insertError);
      return;
    }

    console.log(`✅ บันทึก ${insertedStops.length} stops สำเร็จ!\n`);

    // แสดงรายละเอียด
    insertedStops.forEach((stop, index) => {
      console.log(`   ${index + 1}. Stop ID: ${stop.stop_id}`);
      console.log(`      - Trip: ${stop.trip_id}`);
      console.log(`      - Name: ${stop.stop_name}`);
      console.log(`      - Orders: ${stop.tags.order_count}`);
      console.log(`      - Lat/Lng: ${stop.latitude}, ${stop.longitude}\n`);
    });

    console.log('🎉 เสร็จสิ้น! ตอนนี้แผนที่ควรแสดงข้อมูลได้แล้ว\n');
  } else {
    console.log('⚠️ ไม่มี stops ที่จะสร้าง\n');
  }
}

createStops()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  });
