import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/route-plans/all-trips
 * ดึงรายการ trips ทั้งหมดจาก route plans ที่ status = 'approved'
 * ไม่กรอง trips ที่มี picklist แล้ว (ต่างจาก /api/route-plans/published)
 * ใช้สำหรับ dropdown เลือกสายรถในฟอร์มสร้างใบโหลดสินค้า
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const planDate = searchParams.get('plan_date'); // Optional: filter by plan_date
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว

    // Build query for route plans
    let plansQuery = supabase
      .from('receiving_route_plans')
      .select(`
        plan_id,
        plan_code,
        plan_date,
        status
      `, { count: 'exact' })
      .eq('status', 'approved')
      .order('plan_date', { ascending: false })
      .order('plan_code', { ascending: false });

    // Filter by plan_date if provided
    if (planDate) {
      plansQuery = plansQuery.eq('plan_date', planDate);
    }

    const { data: plans, error: plansError } = await plansQuery;

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      return NextResponse.json(
        { success: false, data: [], error: plansError.message },
        { status: 500 }
      );
    }

    if (!plans || plans.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Get all plan_ids
    const planIds = plans.map(p => p.plan_id);

    // Fetch all trips for these plans (without vehicle join to avoid FK issues)
    const { data: trips, error: tripsError } = await supabase
      .from('receiving_route_trips')
      .select(`
        trip_id,
        plan_id,
        trip_code,
        daily_trip_number,
        vehicle_id,
        driver_id
      `)
      .in('plan_id', planIds)
      .order('daily_trip_number', { ascending: true });

    if (tripsError) {
      console.error('Error fetching trips:', tripsError);
      return NextResponse.json(
        { success: false, data: [], error: tripsError.message },
        { status: 500 }
      );
    }

    // Get vehicle info separately if needed
    const vehicleIds = [...new Set((trips || []).map(t => t.vehicle_id).filter(Boolean))];
    let vehicleMap: Record<number, { plate_number: string; vehicle_type: string }> = {};
    
    if (vehicleIds.length > 0) {
      const { data: vehicles } = await supabase
        .from('master_vehicle')
        .select('vehicle_id, plate_number, vehicle_type')
        .in('vehicle_id', vehicleIds);
      
      if (vehicles) {
        vehicleMap = vehicles.reduce((acc, v) => {
          acc[v.vehicle_id] = { plate_number: v.plate_number, vehicle_type: v.vehicle_type };
          return acc;
        }, {} as Record<number, { plate_number: string; vehicle_type: string }>);
      }
    }

    // Map trips with plan info
    const tripsWithPlanInfo = (trips || []).map(trip => {
      const plan = plans.find(p => p.plan_id === trip.plan_id);
      const vehicle = trip.vehicle_id ? vehicleMap[trip.vehicle_id] : null;
      return {
        trip_id: trip.trip_id,
        trip_number: `${plan?.plan_code || ''}-${trip.trip_code}`,
        trip_code: trip.trip_code,
        daily_trip_number: trip.daily_trip_number,
        plan_id: trip.plan_id,
        plan_code: plan?.plan_code || '',
        plan_date: plan?.plan_date || '',
        vehicle_id: trip.vehicle_id,
        vehicle_plate: vehicle?.plate_number || null,
        vehicle_type: vehicle?.vehicle_type || null
      };
    });

    // Sort by daily_trip_number
    tripsWithPlanInfo.sort((a, b) => (a.daily_trip_number || 0) - (b.daily_trip_number || 0));

    // ✅ REMOVED PAGINATION: ส่งข้อมูลทั้งหมดเพื่อความเร็ว
    return NextResponse.json({ 
      success: true, 
      data: tripsWithPlanInfo
    });
  } catch (error: any) {
    console.error('Error in all-trips API:', error);
    return NextResponse.json(
      { success: false, data: [], error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
