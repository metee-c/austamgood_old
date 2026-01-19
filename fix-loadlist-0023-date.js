/**
 * แก้ไขเลข loadlist LD-20260119-0005 ที่ถูกสร้างจาก BFS ที่แมพกับ picklist
 * ให้ใช้เลขตาม plan_date (20 มกราคม) แทนวันที่สร้าง (19 มกราคม)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixLoadlistDate() {
  console.log('🔍 ตรวจสอบ LD-20260119-0005...\n');

  // 1. ดึงข้อมูล loadlist
  const { data: loadlist, error: loadlistError } = await supabase
    .from('loadlists')
    .select('*')
    .eq('loadlist_code', 'LD-20260119-0005')
    .single();

  if (loadlistError || !loadlist) {
    console.error('❌ ไม่พบ loadlist:', loadlistError?.message);
    return;
  }

  console.log('📦 ข้อมูล loadlist:');
  console.log('  - loadlist_code:', loadlist.loadlist_code);
  console.log('  - created_at:', loadlist.created_at);
  console.log('  - status:', loadlist.status);
  console.log('');

  // 2. ดึง plan_date จาก BFS ที่แมพ
  const { data: bfsMapping } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select(`
      bonus_face_sheet_id,
      mapped_picklist_id,
      picklists:mapped_picklist_id (
        picklist_code,
        trip_id,
        receiving_route_trips!inner (
          trip_code,
          plan_id,
          receiving_route_plans!inner (
            plan_code,
            plan_date
          )
        )
      )
    `)
    .eq('loadlist_id', loadlist.id)
    .not('mapped_picklist_id', 'is', null)
    .limit(1)
    .single();

  if (!bfsMapping?.picklists?.receiving_route_trips?.receiving_route_plans?.plan_date) {
    console.error('❌ ไม่พบ plan_date จาก picklist');
    return;
  }

  const planDate = bfsMapping.picklists.receiving_route_trips.receiving_route_plans.plan_date;
  const picklistCode = bfsMapping.picklists.picklist_code;
  const planCode = bfsMapping.picklists.receiving_route_trips.receiving_route_plans.plan_code;

  console.log('📅 ข้อมูล plan:');
  console.log('  - picklist:', picklistCode);
  console.log('  - plan:', planCode);
  console.log('  - plan_date:', planDate);
  console.log('');

  // 3. หาเลขลำดับถัดไปสำหรับวันที่ plan_date
  const datePrefix = planDate.replace(/-/g, '');
  
  const { data: latestLoadlist } = await supabase
    .from('loadlists')
    .select('loadlist_code')
    .like('loadlist_code', `LD-${datePrefix}-%`)
    .order('loadlist_code', { ascending: false })
    .limit(1)
    .single();

  let sequenceNumber = 1;
  if (latestLoadlist?.loadlist_code) {
    const lastSequence = latestLoadlist.loadlist_code.split('-')[2];
    if (lastSequence) {
      sequenceNumber = parseInt(lastSequence, 10) + 1;
    }
  }

  const newLoadlistCode = `LD-${datePrefix}-${String(sequenceNumber).padStart(4, '0')}`;

  console.log('🔄 เลขใหม่ที่จะใช้:', newLoadlistCode);
  console.log('');

  // 4. อัพเดท loadlist_code
  const { error: updateError } = await supabase
    .from('loadlists')
    .update({ loadlist_code: newLoadlistCode })
    .eq('id', loadlist.id);

  if (updateError) {
    console.error('❌ ไม่สามารถอัพเดทได้:', updateError.message);
    return;
  }

  console.log('✅ อัพเดทสำเร็จ!');
  console.log(`   ${loadlist.loadlist_code} → ${newLoadlistCode}`);
  console.log('');

  // 5. ตรวจสอบผลลัพธ์
  const { data: updated } = await supabase
    .from('loadlists')
    .select('loadlist_code, created_at, status')
    .eq('id', loadlist.id)
    .single();

  console.log('📋 ข้อมูลหลังอัพเดท:');
  console.log('  - loadlist_code:', updated.loadlist_code);
  console.log('  - created_at:', updated.created_at);
  console.log('  - status:', updated.status);
  console.log('  - plan_date:', planDate, '(วันที่กำหนดส่งของ)');
}

fixLoadlistDate()
  .then(() => {
    console.log('\n✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  });
