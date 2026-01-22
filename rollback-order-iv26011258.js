require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function rollbackOrder() {
  const orderNo = 'IV26011258';
  
  console.log(`\n🔄 Rollback Order: ${orderNo}\n`);
  
  // 1. ตรวจสอบ Order
  console.log('1️⃣ ตรวจสอบ Order:');
  const { data: order, error: orderError } = await supabase
    .from('wms_orders')
    .select('*')
    .eq('order_no', orderNo)
    .single();
  
  if (orderError || !order) {
    console.error('❌ ไม่พบ Order:', orderError?.message);
    return;
  }
  
  console.log(`✅ พบ Order: ${order.order_no}`);
  console.log(`   สถานะปัจจุบัน: ${order.status}`);
  console.log(`   Order ID: ${order.order_id}`);
  
  // 2. ตรวจสอบว่ามี document items หรือไม่
  console.log('\n2️⃣ ตรวจสอบ Document Items:');
  
  // Check Face Sheets
  const { data: faceSheets } = await supabase
    .from('wms_face_sheet_items')
    .select('face_sheet_id, status')
    .eq('order_id', order.order_id)
    .neq('status', 'voided');
  
  // Check Bonus Face Sheets
  const { data: bonusFaceSheets } = await supabase
    .from('wms_bonus_face_sheet_items')
    .select('bonus_face_sheet_id, status')
    .eq('order_id', order.order_id)
    .neq('status', 'voided');
  
  // Check Picklists
  const { data: picklists } = await supabase
    .from('wms_picklist_items')
    .select('picklist_id, status')
    .eq('order_id', order.order_id)
    .neq('status', 'voided');
  
  console.log(`   Face Sheets: ${faceSheets?.length || 0}`);
  console.log(`   Bonus Face Sheets: ${bonusFaceSheets?.length || 0}`);
  console.log(`   Picklists: ${picklists?.length || 0}`);
  
  if ((faceSheets && faceSheets.length > 0) || 
      (bonusFaceSheets && bonusFaceSheets.length > 0) || 
      (picklists && picklists.length > 0)) {
    console.log('\n⚠️  Order มี document items ที่ยังไม่ได้ void');
    console.log('   ต้อง void documents ก่อนถึงจะ rollback ได้');
    
    // แสดงรายละเอียด documents
    if (faceSheets && faceSheets.length > 0) {
      console.log('\n   Face Sheets:');
      faceSheets.forEach(fs => {
        console.log(`     - ID: ${fs.face_sheet_id}, Status: ${fs.status}`);
      });
    }
    
    if (bonusFaceSheets && bonusFaceSheets.length > 0) {
      console.log('\n   Bonus Face Sheets:');
      bonusFaceSheets.forEach(bfs => {
        console.log(`     - ID: ${bfs.bonus_face_sheet_id}, Status: ${bfs.status}`);
      });
    }
    
    if (picklists && picklists.length > 0) {
      console.log('\n   Picklists:');
      picklists.forEach(pl => {
        console.log(`     - ID: ${pl.picklist_id}, Status: ${pl.status}`);
      });
    }
    
    return;
  }
  
  // 3. ตรวจสอบว่าอยู่ใน Route Plan หรือไม่
  console.log('\n3️⃣ ตรวจสอบ Route Plan:');
  const { data: stops } = await supabase
    .from('wms_route_plan_stops')
    .select(`
      stop_id,
      wms_route_plan_trips!inner (
        trip_id,
        trip_no,
        wms_route_plans!inner (
          plan_id,
          plan_no,
          status
        )
      )
    `)
    .eq('order_id', order.order_id);
  
  if (stops && stops.length > 0) {
    console.log(`⚠️  Order อยู่ใน ${stops.length} Route Plan(s):`);
    stops.forEach(stop => {
      const trip = stop.wms_route_plan_trips;
      const plan = trip.wms_route_plans;
      console.log(`   - Plan: ${plan.plan_no}, Trip: ${trip.trip_no}, Status: ${plan.status}`);
    });
    console.log('\n   ⚠️  ต้องลบ Order ออกจาก Route Plan ก่อน');
    return;
  } else {
    console.log('✅ Order ไม่ได้อยู่ใน Route Plan');
  }
  
  // 4. Rollback Order
  console.log('\n4️⃣ Rollback Order to Draft:');
  
  const { data: updated, error: updateError } = await supabase
    .from('wms_orders')
    .update({
      status: 'draft',
      updated_at: new Date().toISOString()
    })
    .eq('order_id', order.order_id)
    .select()
    .single();
  
  if (updateError) {
    console.error('❌ Error:', updateError.message);
    return;
  }
  
  console.log(`✅ Rollback สำเร็จ!`);
  console.log(`   Order: ${updated.order_no}`);
  console.log(`   สถานะใหม่: ${updated.status}`);
  
  console.log('\n✅ เสร็จสิ้น!');
}

rollbackOrder().catch(console.error);
