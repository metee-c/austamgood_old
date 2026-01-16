const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteEmptyTripWithDependencies() {
  console.log('🔍 ลบ trips ว่างเปล่าพร้อม dependencies\n');

  // ดึง trips ทั้งหมด
  const { data: allTrips } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence, plan_id')
    .order('plan_id');

  console.log(`📊 ตรวจสอบ ${allTrips.length} trips...\n`);

  const emptyTrips = [];

  for (const trip of allTrips) {
    const { data: stops } = await supabase
      .from('receiving_route_stops')
      .select('stop_id')
      .eq('trip_id', trip.trip_id);

    if (!stops || stops.length === 0) {
      emptyTrips.push(trip);
    }
  }

  if (emptyTrips.length === 0) {
    console.log('✅ ไม่มี trips ว่างเปล่า');
    return;
  }

  console.log(`⚠️  พบ ${emptyTrips.length} trips ว่างเปล่า\n`);

  for (const trip of emptyTrips) {
    const { data: plan } = await supabase
      .from('receiving_route_plans')
      .select('plan_code, plan_name')
      .eq('plan_id', trip.plan_id)
      .single();

    console.log(`\n🗑️  กำลังลบ trip_id ${trip.trip_id} (คันที่ ${trip.trip_sequence})`);
    console.log(`   แผน: ${plan.plan_code} - ${plan.plan_name}`);

    // 1. ตรวจสอบ picklists ที่เชื่อมโยง
    const { data: picklists } = await supabase
      .from('picklists')
      .select('picklist_id, picklist_no')
      .eq('trip_id', trip.trip_id);

    if (picklists && picklists.length > 0) {
      console.log(`   📋 พบ ${picklists.length} picklists:`);
      
      for (const picklist of picklists) {
        console.log(`      - ${picklist.picklist_no} (picklist_id: ${picklist.picklist_id})`);

        // ลบ loadlist_bonus_face_sheets ที่เชื่อมโยงกับ picklist นี้
        const { error: deleteBfsError } = await supabase
          .from('wms_loadlist_bonus_face_sheets')
          .delete()
          .eq('mapped_picklist_id', picklist.picklist_id);

        if (deleteBfsError) {
          console.log(`        ❌ ลบ bonus_face_sheets ไม่สำเร็จ: ${deleteBfsError.message}`);
        } else {
          console.log(`        ✅ ลบ bonus_face_sheets สำเร็จ`);
        }

        // ลบ picklist_items
        const { error: deleteItemsError } = await supabase
          .from('picklist_items')
          .delete()
          .eq('picklist_id', picklist.picklist_id);

        if (deleteItemsError) {
          console.log(`        ❌ ลบ picklist_items ไม่สำเร็จ: ${deleteItemsError.message}`);
        } else {
          console.log(`        ✅ ลบ picklist_items สำเร็จ`);
        }

        // ลบ picklist
        const { error: deletePicklistError } = await supabase
          .from('picklists')
          .delete()
          .eq('picklist_id', picklist.picklist_id);

        if (deletePicklistError) {
          console.log(`        ❌ ลบ picklist ไม่สำเร็จ: ${deletePicklistError.message}`);
        } else {
          console.log(`        ✅ ลบ picklist สำเร็จ`);
        }
      }
    }

    // 2. ลบ trip
    const { error: deleteTripError } = await supabase
      .from('receiving_route_trips')
      .delete()
      .eq('trip_id', trip.trip_id);

    if (deleteTripError) {
      console.log(`   ❌ ลบ trip ไม่สำเร็จ: ${deleteTripError.message}`);
    } else {
      console.log(`   ✅ ลบ trip สำเร็จ`);
    }
  }

  console.log(`\n✅ เสร็จสิ้น! ลบ ${emptyTrips.length} trips ว่างเปล่า`);
}

deleteEmptyTripWithDependencies()
  .then(() => {
    console.log('\n🎉 สำเร็จ');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
