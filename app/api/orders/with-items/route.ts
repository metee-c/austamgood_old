import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Build query - get all orders with items first
    let query = supabase
      .from('wms_orders')
      .select(`
        *,
        items:wms_order_items(*)
      `)
      .order('order_date', { ascending: false });

    // Apply filters
    const orderType = searchParams.get('order_type');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const customerId = searchParams.get('customer_id');
    const searchTerm = searchParams.get('searchTerm');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (orderType && orderType !== 'all') {
      query = query.eq('order_type', orderType);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Priority filter removed - column doesn't exist in database
    // if (priority && priority !== 'all') {
    //   query = query.eq('priority', priority);
    // }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (searchTerm) {
      query = query.or(`order_no.ilike.%${searchTerm}%,shop_name.ilike.%${searchTerm}%,customer_id.ilike.%${searchTerm}%`);
    }

    if (startDate) {
      query = query.gte('order_date', startDate);
    }

    if (endDate) {
      query = query.lte('order_date', endDate);
    }

    const { data: ordersData, error } = await query;

    if (error) {
      console.error('Error fetching orders with items:', error);
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    // Get unique customer IDs from orders
    const customerIds = [...new Set(ordersData?.map(order => order.customer_id).filter(Boolean) || [])];

    // Fetch customer coordinates if there are any customer IDs
    let customersMap = new Map();
    if (customerIds.length > 0) {
      const { data: customersData, error: customersError } = await supabase
        .from('master_customer')
        .select('customer_id, latitude, longitude')
        .in('customer_id', customerIds);

      if (!customersError && customersData) {
        customersData.forEach(customer => {
          customersMap.set(customer.customer_id, {
            latitude: customer.latitude,
            longitude: customer.longitude
          });
        });
      } else if (customersError) {
        console.error('Error fetching customers:', customersError);
      }
    }

    // Merge customer data into orders
    const ordersWithCustomer = ordersData?.map(order => ({
      ...order,
      customer: customersMap.get(order.customer_id) || null
    })) || [];

    return NextResponse.json({ data: ordersWithCustomer, error: null });
  } catch (error) {
    console.error('API Error in GET /api/orders/with-items:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
