import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/checklist?id=xxx
 * สร้างใบเช็คสินค้าสำหรับใบปะหน้าของแถม
 * 
 * ดึงข้อมูล trip ที่ถูกต้องจาก receiving_route_stops โดยใช้ customer_id
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const bonusFaceSheetId = parseInt(id);
    if (isNaN(bonusFaceSheetId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID' },
        { status: 400 }
      );
    }

    // ดึงข้อมูลใบปะหน้าของแถม
    const { data: bonusFaceSheet, error: bonusFaceSheetError } = await supabase
      .from('bonus_face_sheets')
      .select(`
        id,
        face_sheet_no,
        warehouse_id,
        status,
        delivery_date,
        total_packages,
        total_items,
        total_orders,
        created_date,
        created_by
      `)
      .eq('id', bonusFaceSheetId)
      .single();

    if (bonusFaceSheetError || !bonusFaceSheet) {
      console.error('Error fetching bonus face sheet:', bonusFaceSheetError);
      return NextResponse.json(
        { success: false, error: 'ไม่พบใบปะหน้าของแถม' },
        { status: 404 }
      );
    }

    // ดึงข้อมูล packages และ items
    const { data: packages, error: packagesError } = await supabase
      .from('bonus_face_sheet_packages')
      .select(`
        id,
        package_number,
        order_id,
        order_no,
        shop_name,
        barcode_id,
        customer_id,
        trip_number,
        bonus_face_sheet_items (
          id,
          sku_id,
          product_name,
          quantity_to_pick,
          quantity_picked,
          status,
          source_location_id
        )
      `)
      .eq('face_sheet_id', bonusFaceSheetId)
      .order('package_number', { ascending: true });

    if (packagesError) {
      console.error('Error fetching packages:', packagesError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลแพ็คเกจได้' },
        { status: 500 }
      );
    }

    // ดึง customer_id จาก wms_orders (เพราะ bonus_face_sheet_packages.customer_id อาจเป็น null)
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

    // ดึงข้อมูล trip ที่ถูกต้องจาก route stops โดยใช้ customer_id
    // สร้าง map: customer_id -> full_trip_code
    const customerIds = [...new Set(
      (packages || [])
        .map(p => orderCustomerMap.get(p.order_id) || p.customer_id)
        .filter(Boolean)
    )];
    const customerTripMap = new Map<string, string>();

    if (customerIds.length > 0 && bonusFaceSheet.delivery_date) {
      // แมพโดยใช้ customer_id (รหัสร้าน) และ delivery_date (วันส่ง) ตรงกัน
      const { data: routeStopsWithTrips } = await supabase
        .from('receiving_route_stops')
        .select(`
          customer_id,
          order_id,
          receiving_route_trips!inner (
            trip_code,
            receiving_route_plans!inner (
              plan_code,
              plan_date,
              status
            )
          )
        `)
        .in('customer_id', customerIds)
        .eq('receiving_route_trips.receiving_route_plans.plan_date', bonusFaceSheet.delivery_date)
        .eq('receiving_route_trips.receiving_route_plans.status', 'approved');

      if (routeStopsWithTrips && routeStopsWithTrips.length > 0) {
        // สร้าง map: customer_id -> full_trip_code (จาก route stops ที่มี customer_id และ delivery_date ตรงกัน)
        for (const stop of routeStopsWithTrips) {
          const customerId = stop.customer_id;
          if (customerId && !customerTripMap.has(customerId)) {
            const tripInfo = stop.receiving_route_trips as any;
            const planInfo = tripInfo.receiving_route_plans;
            const fullTripCode = `${planInfo.plan_code}-${tripInfo.trip_code}`;
            customerTripMap.set(customerId, fullTripCode);
          }
        }
      }
    }

    // เพิ่ม trip_number ที่ถูกต้องให้แต่ละ package
    const packagesWithCorrectTrip = (packages || []).map(pkg => {
      // ดึง customer_id จาก wms_orders ถ้า package.customer_id เป็น null
      const customerId = orderCustomerMap.get(pkg.order_id) || pkg.customer_id;
      return {
        ...pkg,
        // ใช้ trip จาก route stops ถ้ามี, ไม่งั้นใช้ค่าที่เก็บไว้
        trip_number: (customerId ? customerTripMap.get(customerId) : null) || pkg.trip_number || ''
      };
    });

    // หา trip ที่ใช้มากที่สุดสำหรับแสดงใน header
    const tripCounts = new Map<string, number>();
    for (const pkg of packagesWithCorrectTrip) {
      if (pkg.trip_number) {
        tripCounts.set(pkg.trip_number, (tripCounts.get(pkg.trip_number) || 0) + 1);
      }
    }
    let mainTripNumber = '';
    let maxCount = 0;
    for (const [trip, count] of tripCounts) {
      if (count > maxCount) {
        maxCount = count;
        mainTripNumber = trip;
      }
    }

    // จัดรูปแบบข้อมูลสำหรับใบเช็ค
    const checklistData = {
      bonusFaceSheet: {
        ...bonusFaceSheet,
        trip_number: mainTripNumber, // เพิ่ม trip_number หลักสำหรับแสดงใน header
        created_date: new Date(bonusFaceSheet.created_date).toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        delivery_date: new Date(bonusFaceSheet.delivery_date).toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      },
      packages: packagesWithCorrectTrip,
      summary: {
        totalPackages: bonusFaceSheet.total_packages,
        totalItems: bonusFaceSheet.total_items,
        totalOrders: bonusFaceSheet.total_orders,
        totalQuantityToPick: (packages || []).reduce((sum, pkg) => 
          sum + (pkg.bonus_face_sheet_items || []).reduce((itemSum, item) => 
            itemSum + (item.quantity_to_pick || 0), 0
          ), 0
        ),
        totalQuantityPicked: (packages || []).reduce((sum, pkg) => 
          sum + (pkg.bonus_face_sheet_items || []).reduce((itemSum, item) => 
            itemSum + (item.quantity_picked || 0), 0
          ), 0
        )
      }
    };

    return NextResponse.json({
      success: true,
      data: checklistData
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/checklist:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
