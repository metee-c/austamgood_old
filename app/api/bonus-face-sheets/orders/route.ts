import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/orders
 * ดึงรายการออเดอร์ที่มี order_type = 'special' สำหรับสร้างใบปะหน้าของแถม
 * 
 * การหา trip_number:
 * 1. ดึงจาก receiving_route_stops โดยใช้ customer_id ของออเดอร์ของแถม
 *    แมพกับ customer_id ของออเดอร์ปกติที่อยู่ใน route stops
 * 2. สร้าง full trip code: {plan_code}-{trip_code}
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
    
    // ✅ PAGINATION: เพิ่ม page parameter
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
      .order('order_no')
      ;
    
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
    // สร้าง map: customer_id -> { trip_id, trip_code, plan_code, full_trip_code }
    const customerTripMap = new Map<string, { 
      trip_id: number; 
      trip_code: string; 
      plan_code: string;
      full_trip_code: string;
      daily_trip_number: number | null;
      plate_number?: string 
    }>();
    
    if (customerIds.length > 0) {
      // ✅ FIX: ดึง route stops พร้อม trip และ plan info
      // แมพโดยใช้ customer_id จาก wms_orders (ไม่ใช่จาก receiving_route_stops เพราะเป็น null)
      // หา trip จาก route plan ที่มี plan_date = delivery_date และ status = 'approved'
      const { data: routeStopsWithTrips, error: routeError } = await supabase
        .from('receiving_route_stops')
        .select(`
          stop_id,
          trip_id,
          order_id,
          wms_orders!inner (
            order_id,
            customer_id
          ),
          receiving_route_trips!inner (
            trip_id,
            trip_code,
            daily_trip_number,
            vehicle_id,
            plan_id,
            master_vehicle (
              plate_number
            ),
            receiving_route_plans!inner (
              plan_id,
              plan_code,
              plan_date,
              status
            )
          )
        `)
        .eq('receiving_route_trips.receiving_route_plans.plan_date', delivery_date)
        .eq('receiving_route_trips.receiving_route_plans.status', 'approved');
      
      if (routeError) {
        console.error('Error fetching route stops:', routeError);
      }
      
      if (routeStopsWithTrips && routeStopsWithTrips.length > 0) {
        // สร้าง map: customer_id -> trip info (จาก wms_orders.customer_id)
        for (const stop of routeStopsWithTrips) {
          const orderInfo = stop.wms_orders as any;
          const customerId = orderInfo?.customer_id;
          
          if (customerId && customerIds.includes(customerId) && !customerTripMap.has(customerId)) {
            const tripInfo = stop.receiving_route_trips as any;
            const planInfo = tripInfo.receiving_route_plans;
            const fullTripCode = `${planInfo.plan_code}-${tripInfo.trip_code}`;
            
            customerTripMap.set(customerId, {
              trip_id: tripInfo.trip_id,
              trip_code: tripInfo.trip_code,
              plan_code: planInfo.plan_code,
              full_trip_code: fullTripCode,
              daily_trip_number: tripInfo.daily_trip_number,
              plate_number: tripInfo.master_vehicle?.plate_number
            });
          }
        }
      }
      
      console.log('📍 Customer trip mapping:', {
        customerIds: customerIds.length,
        mappedCustomers: customerTripMap.size,
        mappings: Array.from(customerTripMap.entries()).slice(0, 5).map(([k, v]) => ({
          customer_id: k,
          trip: v.full_trip_code,
          daily_trip_number: v.daily_trip_number
        }))
      });
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
        
        // ดึงข้อมูล trip จาก customerTripMap (แมพจาก customer_id ใน route stops)
        let tripNumber = '';
        let matchedTripId = order.matched_trip_id;
        
        const customerTrip = customerTripMap.get(order.customer_id);
        if (customerTrip) {
          // ใช้ full_trip_code: {plan_code}-{trip_code}
          tripNumber = customerTrip.full_trip_code;
          matchedTripId = customerTrip.trip_id;
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
    
    // ✅ PAGINATION: Return with pagination metadata
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
