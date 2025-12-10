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
    
    // ดึงข้อมูล trip ทั้งหมดที่เกี่ยวข้อง
    const tripIds = [...new Set(orders.map(o => o.matched_trip_id).filter(Boolean))];
    let tripMap = new Map();
    
    if (tripIds.length > 0) {
      const { data: trips } = await supabase
        .from('receiving_route_trips')
        .select(`
          id,
          trip_id,
          trip_code,
          vehicle_id,
          master_vehicle (
            plate_number
          )
        `)
        .in('id', tripIds);
      
      tripMap = new Map(
        (trips || []).map(t => [t.id, t])
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
        
        // ดึงข้อมูล trip
        const tripInfo = order.matched_trip_id ? tripMap.get(order.matched_trip_id) : null;
        const tripNumber = tripInfo?.trip_code || 
                          (tripInfo?.master_vehicle?.plate_number ? `รถ ${tripInfo.master_vehicle.plate_number}` : '');
        
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
          matched_trip_id: order.matched_trip_id,
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
