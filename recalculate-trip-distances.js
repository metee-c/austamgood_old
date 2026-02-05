require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const supabase = createClient(supabaseUrl, supabaseKey);

// ฟังก์ชันคำนวณระยะทางระหว่าง 2 จุดโดยใช้ Mapbox Directions API
async function calculateDistance(coordinates) {
  if (!coordinates || coordinates.length < 2) {
    return 0;
  }

  try {
    // สร้าง URL สำหรับ Mapbox Directions API
    const coordsString = coordinates
      .map(coord => `${coord.longitude},${coord.latitude}`)
      .join(';');
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?access_token=${mapboxToken}&geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      // ระยะทางใน meters แปลงเป็น kilometers
      return data.routes[0].distance / 1000;
    }
    
    return 0;
  } catch (error) {
    console.error('❌ Error calculating distance:', error);
    return 0;
  }
}

// ฟังก์ชันคำนวณระยะทางแบบเส้นตรง (fallback)
function calculateStraightLineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // รัศมีโลกใน km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function recalculateTripDistances() {
  console.log('🔄 เริ่มคำนวณระยะทางสำหรับคันที่มีระยะทาง 0.00 km หรือ NULL...\n');

  // ดึงทุกคันแล้วกรองใน JavaScript
  const { data: allTrips, error: tripsError } = await supabase
    .from('receiving_route_trips')
    .select(`
      trip_id,
      plan_id,
      daily_trip_number,
      trip_sequence,
      total_distance_km,
      receiving_route_plans!inner(plan_code, warehouse_id)
    `)
    .order('plan_id')
    .order('daily_trip_number');
  
  if (tripsError) {
    console.error('❌ Error fetching trips:', tripsError);
    return;
  }
  
  // กรองคันที่มี total_distance_km <= 0 หรือ null
  const filteredTrips = allTrips.filter(t => 
    t.total_distance_km === null || 
    t.total_distance_km === 0 || 
    parseFloat(t.total_distance_km) === 0
  );
  
  // ดึง stops แยกสำหรับแต่ละคัน
  const trips = [];
  for (const trip of filteredTrips) {
    const { data: stops } = await supabase
      .from('receiving_route_stops')
      .select(`
        stop_id,
        sequence_no,
        customer_id,
        master_customer!inner(latitude, longitude)
      `)
      .eq('trip_id', trip.trip_id)
      .order('sequence_no');
    
    trips.push({
      ...trip,
      receiving_route_stops: stops || []
    });
  }

  console.log(`📋 พบ ${trips.length} คันที่ต้องคำนวณระยะทาง\n`);

  let updatedCount = 0;
  let failedCount = 0;

  for (const trip of trips) {
    const planCode = trip.receiving_route_plans.plan_code;
    const tripNum = trip.daily_trip_number || trip.trip_sequence;
    const warehouseId = trip.receiving_route_plans.warehouse_id;

    console.log(`\n🚚 กำลังคำนวณ: ${planCode} คันที่ ${tripNum}`);

    // ดึงพิกัดคลังสินค้า
    const { data: warehouse } = await supabase
      .from('master_warehouse')
      .select('latitude, longitude')
      .eq('warehouse_id', warehouseId)
      .single();

    if (!warehouse || !warehouse.latitude || !warehouse.longitude) {
      console.log('   ⚠️  ไม่พบพิกัดคลังสินค้า - ข้าม');
      failedCount++;
      continue;
    }

    // เรียง stops ตาม sequence_no
    const stops = trip.receiving_route_stops
      .sort((a, b) => a.sequence_no - b.sequence_no)
      .filter(stop => stop.master_customer?.latitude && stop.master_customer?.longitude);

    if (stops.length === 0) {
      console.log('   ⚠️  ไม่มี stops ที่มีพิกัด - ข้าม');
      failedCount++;
      continue;
    }

    console.log(`   📍 จำนวน stops: ${stops.length}`);

    // สร้างลำดับพิกัด: คลัง -> stop1 -> stop2 -> ... -> คลัง
    const coordinates = [
      { latitude: warehouse.latitude, longitude: warehouse.longitude },
      ...stops.map(stop => ({
        latitude: stop.master_customer.latitude,
        longitude: stop.master_customer.longitude
      })),
      { latitude: warehouse.latitude, longitude: warehouse.longitude }
    ];

    // คำนวณระยะทาง
    let totalDistance = 0;

    if (mapboxToken && coordinates.length <= 25) {
      // ใช้ Mapbox API (จำกัด 25 waypoints)
      console.log('   🗺️  คำนวณด้วย Mapbox API...');
      totalDistance = await calculateDistance(coordinates);
    } else {
      // ใช้การคำนวณแบบเส้นตรง (fallback)
      console.log('   📏 คำนวณแบบเส้นตรง (fallback)...');
      for (let i = 0; i < coordinates.length - 1; i++) {
        const dist = calculateStraightLineDistance(
          coordinates[i].latitude,
          coordinates[i].longitude,
          coordinates[i + 1].latitude,
          coordinates[i + 1].longitude
        );
        totalDistance += dist;
      }
    }

    if (totalDistance > 0) {
      // อัพเดตระยะทางในฐานข้อมูล
      const { error: updateError } = await supabase
        .from('receiving_route_trips')
        .update({ total_distance_km: totalDistance })
        .eq('trip_id', trip.trip_id);

      if (updateError) {
        console.log(`   ❌ อัพเดตล้มเหลว: ${updateError.message}`);
        failedCount++;
      } else {
        console.log(`   ✅ อัพเดตสำเร็จ: ${totalDistance.toFixed(2)} km`);
        updatedCount++;
      }
    } else {
      console.log('   ⚠️  คำนวณระยะทางไม่ได้ - ข้าม');
      failedCount++;
    }

    // หน่วงเวลาเล็กน้อยเพื่อไม่ให้ถูก rate limit
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n\n📊 สรุปผลการทำงาน:');
  console.log(`✅ อัพเดตสำเร็จ: ${updatedCount} คัน`);
  console.log(`❌ ล้มเหลว/ข้าม: ${failedCount} คัน`);
  console.log(`📋 รวมทั้งหมด: ${trips.length} คัน`);

  // อัพเดตระยะทางรวมของแผนงาน
  console.log('\n🔄 กำลังอัพเดตระยะทางรวมของแผนงาน...');
  
  const uniquePlanIds = [...new Set(trips.map(t => t.plan_id))];
  
  for (const planId of uniquePlanIds) {
    const { data: planTrips } = await supabase
      .from('receiving_route_trips')
      .select('total_distance_km')
      .eq('plan_id', planId);

    if (planTrips) {
      const totalPlanDistance = planTrips.reduce((sum, t) => sum + (t.total_distance_km || 0), 0);
      
      await supabase
        .from('receiving_route_plans')
        .update({ total_distance_km: totalPlanDistance })
        .eq('plan_id', planId);
      
      console.log(`   ✅ อัพเดตแผน ID ${planId}: ${totalPlanDistance.toFixed(2)} km`);
    }
  }

  console.log('\n✨ เสร็จสิ้น!');
}

recalculateTripDistances().catch(console.error);
