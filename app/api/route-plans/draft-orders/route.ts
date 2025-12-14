import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');
    const planDate = searchParams.get('planDate');

    const supabase = await createClient();

    // Build orders query
    let ordersQuery = supabase
      .from('wms_orders')
      .select('*')
      .eq('status', 'draft')
      .eq('order_type', 'route_planning')
      .order('order_date', { ascending: true });

    if (warehouseId) {
      ordersQuery = ordersQuery.or(`warehouse_id.eq.${warehouseId},warehouse_id.is.null`);
    }

    if (planDate) {
      ordersQuery = ordersQuery.eq('delivery_date', planDate);
    }

    // Fetch orders
    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) throw ordersError;

    // Collect unique customer IDs
    const customerIds = new Set<string>();
    if (orders) {
      orders.forEach((order: any) => {
        if (order.customer_id) {
          customerIds.add(order.customer_id);
        }
      });
    }

    // Fetch customers if needed
    let customersData: any[] = [];
    if (customerIds.size > 0) {
      const { data: customers } = await supabase
        .from('master_customer')
        .select('customer_id, customer_name, customer_code, latitude, longitude')
        .in('customer_id', Array.from(customerIds));
      
      customersData = customers || [];
    }

    // Combine orders with customer data
    const combinedData = orders?.map((order: any) => {
      const customer = customersData.find(c => c.customer_id === order.customer_id);
      return {
        ...order,
        customer: customer || null
      };
    }) || [];

    console.log('Draft orders query:', {
      warehouseId,
      planDate,
      count: combinedData.length,
      orders: combinedData.slice(0, 5).map((o: any) => ({
        order_id: o.order_id,
        order_no: o.order_no,
        status: o.status,
        order_type: o.order_type,
        warehouse_id: o.warehouse_id
      }))
    });

    return NextResponse.json({ data: combinedData, error: null });
  } catch (error: any) {
    console.error('Error fetching draft orders:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
