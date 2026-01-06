import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/orders
 * ดึงรายการออเดอร์ที่มี order_type = 'special' สำหรับสร้างใบปะหน้าของแถม
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const delivery_date = searchParams.get('delivery_date');
    
    if (!delivery_date) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุวันส่งของ (delivery_date)' },
        { status: 400 }
      );
    }
    
    // ดึงออเดอร์ที่มี order_type = 'special' และวันส่งของตรงกัน
    const { data: orders, error: ordersError } = await supabase
      .from('wms_orders')
      .select(`
        order_id,
        order_no,
        customer_id,
        shop_name,
        province,
        delivery_date,
        total_items,
        total_qty,
        text_field_long_1,
        text_field_additional_4,
        phone,
        notes,
        notes_additional,
        sales_territory,
        matched_trip_id
      `)
      .eq('order_type', 'special')
      .eq('delivery_date', delivery_date)
      .order('shop_name')
      .order('order_no');
    
    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลออเดอร์ได้' },
        { status: 500 }
      );
    }
    
    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'ไม่พบออเดอร์สินค้าของแถมสำหรับวันที่เลือก'
      });
    }
    
    // ดึงข้อมูล customer ทั้งหมดที่เกี่ยวข้อง
    const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];
    const { data: customers } = await supabase
      .from('master_customer')
      .select('customer_id, customer_code, customer_name, hub, shipping_address')
      .in('customer_id', customerIds);
    
    const customerMap = new Map(
      (customers || []).map(c => [c.customer_id, c])
    );
    
    // ดึงข้อมูล trip โดยแมพจาก customer_id ผ่าน route stops
    // เนื่องจากออเดอร์ของแถม (order_type = 'special') ไม่มี matched_trip_id
    // ต้องหา trip จาก route plan ที่มี delivery_date เดียวกัน และมี customer_id ตรงกัน
    const customerTripMap = new Map<string, { trip_id: number; trip_code: string; plate_number?: string }>();
    
    if (customerIds.length > 0) {
      // ดึง route stops ที่มี customer_id ตรงกับออเดอร์ของแถม
      // โดยหา trip จาก route plan ที่มี plan_date = delivery_date และ status = 'approved'
      const { data: routeStopsWithTrips } = await supabase
        .from('receiving_route_stops')
        .select(`
          stop_id,
          trip_id,
          order_id,
          receiving_route_trips!inner (
            trip_id,
            trip_code,
            vehicle_id,
            plan_id,
            master_vehicle (
              plate_number
            ),
            receiving_route_plans!inner (
              plan_id,
              plan_date,
              status
            )
          )
        `)
        .eq('receiving_route_trips.receiving_route_plans.plan_date', delivery_date)
        .eq('receiving_route_trips.receiving_route_plans.status', 'approved');
      
      if (routeStopsWithTrips && routeStopsWithTrips.length > 0) {
        // ดึง order_ids จาก route stops
        const stopOrderIds = routeStopsWithTrips.map(s => s.order_id).filter(Boolean);
        
        if (stopOrderIds.length > 0) {
          // ดึง customer_id จาก orders ที่อยู่ใน route stops
          const { data: stopOrders } = await supabase
            .from('wms_orders')
            .select('order_id, customer_id')
            .in('order_id', stopOrderIds);
          
          // สร้าง map: order_id -> customer_id
          const orderCustomerMap = new Map(
            (stopOrders || []).map(o => [o.order_id, o.customer_id])
          );
          
          // สร้าง map: customer_id -> trip info
          for (const stop of routeStopsWithTrips) {
            const customerId = orderCustomerMap.get(stop.order_id);
            if (customerId && !customerTripMap.has(customerId)) {
              const tripInfo = stop.receiving_route_trips as any;
              customerTripMap.set(customerId, {
                trip_id: tripInfo.trip_id,
                trip_code: tripInfo.trip_code,
                plate_number: tripInfo.master_vehicle?.plate_number
              });
            }
          }
        }
      }
    }
    
    // Fallback: ดึงข้อมูล trip จาก matched_trip_id (สำหรับออเดอร์ที่มี matched_trip_id อยู่แล้ว)
    const tripIds = [...new Set(orders.map(o => o.matched_trip_id).filter(Boolean))];
    let tripMap = new Map();
    
    if (tripIds.length > 0) {
      const { data: trips } = await supabase
        .from('receiving_route_trips')
        .select(`
          trip_id,
          trip_code,
          vehicle_id,
          master_vehicle (
            plate_number
          )
        `)
        .in('trip_id', tripIds);
      
      tripMap = new Map(
        (trips || []).map(t => [t.trip_id, t])
      );
    }
    
    // ดึงรายการสินค้าของแต่ละออเดอร์
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const { data: items } = await supabase
          .from('wms_order_items')
          .select(`
            order_item_id,
            sku_id,
            sku_name,
            order_qty,
            order_weight
          `)
          .eq('order_id', order.order_id)
          .gt('order_qty', 0);
        
        // ดึงข้อมูล customer
        const customer = customerMap.get(order.customer_id);
        
        // ดึงข้อมูล trip - ลองจาก customerTripMap ก่อน (แมพจาก route stops)
        // ถ้าไม่เจอ ลองจาก matched_trip_id
        let tripNumber = '';
        let matchedTripId = order.matched_trip_id;
        
        // 1. ลองหาจาก customerTripMap (แมพจาก customer_id ใน route stops)
        const customerTrip = customerTripMap.get(order.customer_id);
        if (customerTrip) {
          tripNumber = customerTrip.trip_code || 
                      (customerTrip.plate_number ? `รถ ${customerTrip.plate_number}` : '');
          matchedTripId = customerTrip.trip_id;
        }
        // 2. Fallback: ใช้ matched_trip_id ถ้ามี
        else if (order.matched_trip_id) {
          const tripInfo = tripMap.get(order.matched_trip_id);
          if (tripInfo) {
            tripNumber = tripInfo.trip_code || 
                        (tripInfo.master_vehicle?.plate_number ? `รถ ${tripInfo.master_vehicle.plate_number}` : '');
          }
        }
        
        return {
          order_id: order.order_id,
          order_no: order.order_no,
          customer_id: order.customer_id,
          customer_code: customer?.customer_code || '',
          shop_name: order.shop_name || customer?.customer_name || '',
          province: order.province || '',
          delivery_date: order.delivery_date,
          address: order.text_field_long_1 || customer?.shipping_address || '',
          contact_info: order.text_field_additional_4 || '',
          phone: order.phone || '',
          hub: customer?.hub || 'ไม่ระบุ',
          remark: order.notes || '',
          notes_additional: order.notes_additional || '',
          delivery_type: order.notes_additional || 'จัดส่งพร้อมออเดอร์',
          sales_territory: order.sales_territory || '',
          trip_number: tripNumber,
          matched_trip_id: matchedTripId,
          total_items: order.total_items || 0,
          total_qty: order.total_qty || 0,
          items: (items || []).map(item => ({
            order_item_id: item.order_item_id,
            product_code: item.sku_id,
            product_name: item.sku_name || '',
            quantity: item.order_qty,
            weight: item.order_weight
          }))
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      data: ordersWithItems,
      total_orders: ordersWithItems.length,
      message: `พบออเดอร์สินค้าของแถม ${ordersWithItems.length} ออเดอร์`
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/orders:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
