const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function resetIV27Orders() {
  console.log('🔄 Reset IV27 Orders สำหรับการทดสอบ\n');
  console.log('='.repeat(70));

  const orderNos = ['IV27010941', 'IV27010942', 'IV27010943', 'IV27010944', 'IV27010947'];

  // 1. Check current status
  console.log('\n1️⃣ ตรวจสอบสถานะปัจจุบัน...');
  const { data: currentOrders } = await supabase
    .from('wms_orders')
    .select('order_no, status, matched_trip_id')
    .in('order_no', orderNos);

  console.log('Current status:');
  currentOrders?.forEach(o => {
    console.log(`   - ${o.order_no}: ${o.status}, Trip: ${o.matched_trip_id || 'NULL'}`);
  });

  // 2. Reset orders to 'confirmed' status
  console.log('\n2️⃣ Reset orders เป็น status = confirmed...');
  const { data: updated, error: updateError } = await supabase
    .from('wms_orders')
    .update({
      status: 'confirmed',
      matched_trip_id: null,
      auto_matched_at: null
    })
    .in('order_no', orderNos)
    .select('order_no, status');

  if (updateError) {
    console.error('❌ Error updating orders:', updateError);
    return;
  }

  console.log('✅ Updated orders:');
  updated?.forEach(o => {
    console.log(`   - ${o.order_no}: ${o.status}`);
  });

  // 3. Verify
  console.log('\n3️⃣ ตรวจสอบผลลัพธ์...');
  const { data: verified } = await supabase
    .from('wms_orders')
    .select('order_no, status, matched_trip_id')
    .in('order_no', orderNos);

  console.log('\n' + '='.repeat(70));
  console.log('📊 สรุปผลลัพธ์:');
  console.log('='.repeat(70));
  verified?.forEach(o => {
    console.log(`✅ ${o.order_no}: ${o.status}, Trip: ${o.matched_trip_id || 'NULL'}`);
  });

  console.log('\n✅ Orders พร้อมสำหรับการสร้าง Route Plan ใหม่!');
  console.log('💡 ตอนนี้สามารถไปที่หน้า Routes และสร้าง Plan ใหม่ได้แล้ว');
}

resetIV27Orders().catch(console.error);
