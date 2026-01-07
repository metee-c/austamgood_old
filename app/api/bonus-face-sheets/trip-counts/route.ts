import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/trip-counts?bonus_face_sheet_id=xxx
 * คืนค่าจำนวน bonus packages แยกตาม trip_number
 * 
 * การหา trip ที่ถูกต้อง:
 * 1. ดึง customer_id จาก wms_orders ของแต่ละ package
 * 2. หา trip จาก receiving_route_stops โดยแมพผ่าน order_id -> wms_orders.customer_id
 * 3. สร้าง full trip code: {plan_code}-{trip_code}
 * 4. ดึง delivery_number จาก loadlists ตาม trip_id
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const bonusFaceSheetId = searchParams.get('bonus_face_sheet_id');

    if (!bonusFaceSheetId) {
      return NextResponse.json({ error: 'bonus_face_sheet_id is required' }, { status: 400 });
    }

    const bonusFaceSheetIdNum = parseInt(bonusFaceSheetId);
    if (isNaN(bonusFaceSheetIdNum)) {
      return NextResponse.json({ error: 'Invalid bonus_face_sheet_id' }, { status: 400 });
    }

    // ดึงข้อมูล bonus_face_sheet เพื่อเอา delivery_date
    const { data: bonusFaceSheet, error: bfsError } = await supabase
      .from('bonus_face_sheets')
      .select('id, delivery_date')
      .eq('id', bonusFaceSheetIdNum)
      .single();

    if (bfsError || !bonusFaceSheet) {
      console.error('Error fetching bonus face sheet:', bfsError);
      return NextResponse.json({ error: 'Bonus face sheet not found' }, { status: 404 });
    }

    // ดึง packages พร้อม order_id
    const { data: packages, error: packagesError } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, order_id')
      .eq('face_sheet_id', bonusFaceSheetIdNum);

    if (packagesError) {
      console.error('Error fetching bonus packages:', packagesError);
      return NextResponse.json({ error: 'Failed to fetch bonus packages' }, { status: 500 });
    }

    // ดึง customer_id จาก wms_orders
    const orderIds = [...new Set((packages || []).map(p => p.order_id).filter(Boolean))];
    const orderCustomerMap = new Map<number, string>();

    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('wms_orders')
        .select('order_id, customer_id')
        .in('order_id', orderIds);

      for (const order of orders || []) {
        if (order.customer_id) {
          orderCustomerMap.set(order.order_id, order.customer_id);
        }
      }
    }

    // ดึง trip ที่ถูกต้องจาก route stops โดยแมพผ่าน customer_id
    // หา trip จาก route plan ที่มี plan_date = delivery_date และ status = 'approved'
    const customerIds = [...new Set(Array.from(orderCustomerMap.values()))];
    const customerTripMap = new Map<string, { fullTripCode: string; tripId: number }>();

    if (customerIds.length > 0 && bonusFaceSheet.delivery_date) {
      // ดึง route stops พร้อม trip และ plan info
      // แมพโดยใช้ order.customer_id (รหัสร้าน) ที่ตรงกับ customer_id ของออเดอร์ปกติใน route stops
      const { data: routeStopsWithTrips } = await supabase
        .from('receiving_route_stops')
        .select(`
          stop_id,
          order_id,
          receiving_route_trips!inner (
            trip_id,
            trip_code,
            receiving_route_plans!inner (
              plan_code,
              plan_date,
              status
            )
          )
        `)
        .eq('receiving_route_trips.receiving_route_plans.plan_date', bonusFaceSheet.delivery_date)
        .eq('receiving_route_trips.receiving_route_plans.status', 'approved');

      if (routeStopsWithTrips && routeStopsWithTrips.length > 0) {
        // ดึง customer_id ของออเดอร์ใน route stops
        const routeOrderIds = routeStopsWithTrips.map(s => s.order_id).filter(Boolean);
        const routeOrderCustomerMap = new Map<number, string>();

        if (routeOrderIds.length > 0) {
          const { data: routeOrders } = await supabase
            .from('wms_orders')
            .select('order_id, customer_id')
            .in('order_id', routeOrderIds);

          for (const order of routeOrders || []) {
            if (order.customer_id) {
              routeOrderCustomerMap.set(order.order_id, order.customer_id);
            }
          }
        }

        // สร้าง map: customer_id -> { fullTripCode, tripId }
        for (const stop of routeStopsWithTrips) {
          const customerId = routeOrderCustomerMap.get(stop.order_id);
          if (customerId && !customerTripMap.has(customerId)) {
            const tripInfo = stop.receiving_route_trips as any;
            const planInfo = tripInfo.receiving_route_plans;
            const fullTripCode = `${planInfo.plan_code}-${tripInfo.trip_code}`;
            customerTripMap.set(customerId, {
              fullTripCode,
              tripId: tripInfo.trip_id
            });
          }
        }
      }
    }

    // ดึง delivery_number จาก loadlists ตาม trip_id
    const tripIds = [...new Set(Array.from(customerTripMap.values()).map(t => t.tripId))];
    const tripDeliveryNumberMap = new Map<number, string>();

    if (tripIds.length > 0) {
      const { data: loadlists } = await supabase
        .from('loadlists')
        .select('trip_id, delivery_number')
        .in('trip_id', tripIds);

      for (const ll of loadlists || []) {
        if (ll.trip_id && ll.delivery_number) {
          tripDeliveryNumberMap.set(ll.trip_id, ll.delivery_number);
        }
      }
    }

    // Group by trip_number (ใช้ trip ที่ถูกต้องจาก route stops)
    const tripCounts: Record<string, { 
      packageCount: number; 
      orderCount: number; 
      orderIds: number[];
      tripId: number | null;
      deliveryNumber: string | null;
    }> = {};

    (packages || []).forEach(pkg => {
      // หา trip จาก customer_id ของออเดอร์
      const customerId = orderCustomerMap.get(pkg.order_id);
      const tripInfo = customerId ? customerTripMap.get(customerId) : null;
      const tripNumber = tripInfo?.fullTripCode || 'NO_TRIP';
      const tripId = tripInfo?.tripId || null;
      const deliveryNumber = tripId ? tripDeliveryNumberMap.get(tripId) || null : null;

      if (!tripCounts[tripNumber]) {
        tripCounts[tripNumber] = { 
          packageCount: 0, 
          orderCount: 0, 
          orderIds: [],
          tripId,
          deliveryNumber
        };
      }
      tripCounts[tripNumber].packageCount++;
      if (pkg.order_id && !tripCounts[tripNumber].orderIds.includes(pkg.order_id)) {
        tripCounts[tripNumber].orderIds.push(pkg.order_id);
      }
    });

    // Calculate orderCount from unique orderIds
    Object.keys(tripCounts).forEach(tripNumber => {
      tripCounts[tripNumber].orderCount = tripCounts[tripNumber].orderIds.length;
      // Remove orderIds from response (not needed by frontend)
      delete (tripCounts[tripNumber] as any).orderIds;
    });

    // Sort by trip_number
    const sortedTrips = Object.entries(tripCounts)
      .sort(([a], [b]) => {
        // Put NO_TRIP and empty string at the end
        if (a === 'NO_TRIP' || a === '') return 1;
        if (b === 'NO_TRIP' || b === '') return -1;
        return a.localeCompare(b);
      })
      .map(([tripNumber, counts]) => ({
        trip_number: tripNumber === 'NO_TRIP' ? 'ไม่ระบุสายรถ' : tripNumber,
        trip_number_raw: tripNumber, // เก็บค่าจริงสำหรับ filter
        delivery_number: counts.deliveryNumber, // เลขเที่ยวจริงจากใบว่าจ้าง
        packageCount: counts.packageCount,
        orderCount: counts.orderCount
      }));

    return NextResponse.json({
      success: true,
      data: sortedTrips
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/trip-counts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
