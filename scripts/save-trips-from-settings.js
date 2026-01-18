/**
 * บันทึก trips จาก settings.optimizedTrips ลงฐานข้อมูล
 * สำหรับแก้ปัญหาแผนที่ไม่แสดงข้อมูล
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function saveTripsFromSettings(planId) {
  console.log(`\n🔍 กำลังตรวจสอบแผน ID: ${planId}...\n`);

  // 1. ดึงข้อมูลแผน
  const { data: plan, error: planError } = await supabase
    .from('receiving_route_plans')
    .select('*')
    .eq('plan_id', planId)
    .single();

  if (planError || !plan) {
    console.error('❌ ไม่พบแผน:', planError?.message);
    return;
  }

  console.log(`📋 แผน: ${plan.plan_name}`);
  console.log(`📅 วันที่: ${plan.plan_date}`);
  console.log(`📊 สถานะ: ${plan.status}`);

  // 2. ตรวจสอบว่ามี optimizedTrips ใน settings หรือไม่
  if (!plan.settings?.optimizedTrips || plan.settings.optimizedTrips.length === 0) {
    console.log('⚠️ ไม่พบ optimizedTrips ใน settings');
    return;
  }

  const optimizedTrips = plan.settings.optimizedTrips;
  console.log(`\n✅ พบ ${optimizedTrips.length} trips ใน settings\n`);

  // 3. ตรวจสอบว่ามี trips ในฐานข้อมูลแล้วหรือไม่
  const { data: existingTrips } = await supabase
    .from('receiving_route_trips')
    .select('trip_id, trip_sequence')
    .eq('plan_id', planId);

  if (existingTrips && existingTrips.length > 0) {
    console.log(`⚠️ มี trips อยู่แล้ว ${existingTrips.length} trips`);
    console.log('ต้องการลบและสร้างใหม่หรือไม่? (กด Ctrl+C เพื่อยกเลิก)');
    
    // ลบ trips เดิม
    const { error: deleteError } = await supabase
      .from('receiving_route_trips')
      .delete()
      .eq('plan_id', planId);

    if (deleteError) {
      console.error('❌ ลบ trips เดิมไม่สำเร็จ:', deleteError.message);
      return;
    }
    console.log('✅ ลบ trips เดิมสำเร็จ\n');
  }

  // 4. เตรียมข้อมูล trips
  const planDate = new Date(plan.plan_date).toISOString().split('T')[0];
  const vehicleCapacity = plan.settings?.vehicleCapacityKg || 2200;

  const tripsData = optimizedTrips.map((trip, index) => {
    const capacityUtil = vehicleCapacity > 0 
      ? ((trip.totalWeight || 0) / vehicleCapacity) * 100 
      : 0;

    return {
      plan_id: planId,
      trip_sequence: trip.tripSequence || index + 1,
      trip_code: `TRIP-${String(trip.tripSequence || index + 1).padStart(3, '0')}`,
      trip_status: 'planned',
      warehouse_id: plan.warehouse_id,
      total_distance_km: trip.totalDistance || 0,
      total_drive_minutes: Math.round(trip.totalDriveTime || 0),
      total_service_minutes: Math.round(trip.totalServiceTime || 0),
      total_stops: trip.stops?.length || 0,
      total_weight_kg: trip.totalWeight || 0,
      total_volume_cbm: trip.totalVolume || 0,
      total_pallets: trip.totalPallets || 0,
      capacity_utilization: Math.round(capacityUtil),
      fuel_cost_estimate: trip.totalCost || 0,
      shipping_cost: null,
      base_price: trip.basePrice || null,
      helper_fee: trip.helperFee || null,
      extra_stop_fee: trip.extraStopFee || null,
      is_overweight: trip.isOverweight || false,
      notes: trip.zoneName ? `โซน: ${trip.zoneName}` : null
    };
  });

  console.log('💾 กำลังบันทึก trips...');

  // 5. บันทึก trips (ไม่ใช้ RPC เพราะ warehouse_id เป็น VARCHAR)
  const { data: maxDailyNumber } = await supabase
    .rpc('get_next_daily_trip_number', { p_plan_date: planDate });
  
  const nextDailyNumber = maxDailyNumber || 1;
  
  const tripsToInsert = tripsData.map((trip, index) => ({
    ...trip,
    daily_trip_number: nextDailyNumber + index
  }));

  const { data: insertedTrips, error: insertError } = await supabase
    .from('receiving_route_trips')
    .insert(tripsToInsert)
    .select();
  
  if (insertError) {
    console.error('❌ บันทึก trips ไม่สำเร็จ:', insertError.message);
    console.error('   Details:', insertError);
    return;
  }

  console.log(`✅ บันทึก ${insertedTrips.length} trips สำเร็จ\n`);

  // 6. บันทึก stops
  let totalStops = 0;
  
  for (let i = 0; i < optimizedTrips.length; i++) {
    const trip = optimizedTrips[i];
    const insertedTrip = insertedTrips[i];
    
    if (!trip.stops || trip.stops.length === 0) {
      console.log(`⚠️ Trip ${i + 1}: ไม่มี stops`);
      continue;
    }

    console.log(`💾 กำลังบันทึก stops สำหรับ Trip ${i + 1} (${trip.stops.length} stops)...`);

    const stopsData = trip.stops.map((stop, stopIndex) => {
      // หา order_id จาก orderIds array หรือ id
      const orderIds = stop.orderIds || [];
      const primaryOrderId = orderIds[0] || stop.id;

      return {
        trip_id: insertedTrip.trip_id,
        plan_id: planId,
        sequence_no: stopIndex + 1,
        stop_type: 'delivery',
        status: 'pending',
        stop_name: stop.stopName || stop.address || 'Unknown',
        latitude: stop.latitude,
        longitude: stop.longitude,
        address: stop.address || stop.stopName,
        order_id: primaryOrderId,
        load_weight_kg: stop.weight || 0,
        load_volume_cbm: stop.volume || 0,
        load_pallets: stop.pallets || 0,
        load_units: stop.units || 0,
        service_duration_minutes: stop.serviceTime || 15,
        travel_minutes_from_prev: Math.round(stop.driveTimeFromPrevious || 0),
        tags: {
          order_ids: orderIds,
          input_ids: stop.inputIds || [],
          order_count: stop.orderCount || orderIds.length,
          estimated_arrival: stop.estimatedArrival || null,
          estimated_departure: stop.estimatedDeparture || null
        }
      };
    });

    const { error: stopsError } = await supabase
      .from('receiving_route_stops')
      .insert(stopsData);

    if (stopsError) {
      console.error(`❌ บันทึก stops สำหรับ Trip ${i + 1} ไม่สำเร็จ:`, stopsError.message);
    } else {
      console.log(`✅ บันทึก ${stopsData.length} stops สำเร็จ`);
      totalStops += stopsData.length;
    }
  }

  console.log(`\n✅ บันทึกทั้งหมดสำเร็จ!`);
  console.log(`   - Trips: ${insertedTrips.length}`);
  console.log(`   - Stops: ${totalStops}\n`);

  // 7. ลบ optimizedTrips ออกจาก settings
  const { optimizedTrips: _, ...remainingSettings } = plan.settings;
  
  const { error: updateError } = await supabase
    .from('receiving_route_plans')
    .update({ settings: remainingSettings })
    .eq('plan_id', planId);

  if (updateError) {
    console.error('⚠️ ลบ optimizedTrips จาก settings ไม่สำเร็จ:', updateError.message);
  } else {
    console.log('✅ ลบ optimizedTrips จาก settings สำเร็จ\n');
  }

  console.log('🎉 เสร็จสิ้น! ตอนนี้แผนที่ควรแสดงข้อมูลได้แล้ว\n');
}

// รัน script
const planId = process.argv[2] || 251; // ใช้ plan_id จาก argument หรือ default 251

saveTripsFromSettings(parseInt(planId))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  });
