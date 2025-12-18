import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Build query
    let query = supabase
      .from('wms_orders')
      .select('*')
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
      const hasSpecialChars = /[|,()\\]/.test(searchTerm);
      if (!hasSpecialChars) {
        query = query.or(`order_no.ilike.%${searchTerm}%`);
      }
    }

    if (startDate) {
      query = query.gte('order_date', startDate);
    }

    if (endDate) {
      query = query.lte('order_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('API Error in GET /api/orders:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['order_type', 'customer_id', 'order_date', 'delivery_date'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          data: null,
          error: `Missing required fields: ${missingFields.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate items
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        {
          data: null,
          error: 'At least one item must be included in the order.'
        },
        { status: 400 }
      );
    }

    // Generate order number
    const { data: lastOrder } = await supabase
      .from('wms_orders')
      .select('order_no')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let orderNo = 'SO-2025-0001';
    if (lastOrder?.order_no) {
      const lastNumber = parseInt(lastOrder.order_no.split('-')[2]);
      const newNumber = (lastNumber + 1).toString().padStart(4, '0');
      orderNo = `SO-2025-${newNumber}`;
    }

    // Calculate total amount
    const totalAmount = body.items.reduce((sum: number, item: any) => {
      return sum + (item.ordered_qty * item.unit_price);
    }, 0);

    // Create order header
    const { data: orderData, error: orderError } = await supabase
      .from('wms_orders')
      .insert({
        order_no: orderNo,
        order_type: body.order_type,
        customer_id: body.customer_id,
        order_date: body.order_date,
        delivery_date: body.delivery_date,
        status: body.status || 'draft',
        total_amount: totalAmount,
        shipping_address: body.shipping_address,
        delivery_instructions: body.delivery_instructions,
        notes: body.notes,
        created_by: body.created_by
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json(
        { data: null, error: orderError.message },
        { status: 500 }
      );
    }

    // Create order items
    const orderItems = body.items.map((item: any) => ({
      order_id: orderData.order_id,
      sku_id: item.sku_id,
      ordered_qty: item.ordered_qty,
      picked_qty: 0,
      shipped_qty: 0,
      unit_price: item.unit_price,
      line_total: item.ordered_qty * item.unit_price
    }));

    const { error: itemsError } = await supabase
      .from('wms_order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Rollback: delete the order
      await supabase
        .from('wms_orders')
        .delete()
        .eq('order_id', orderData.order_id);

      return NextResponse.json(
        { data: null, error: itemsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: orderData, error: null },
      { status: 201 }
    );
  } catch (error) {
    console.error('API Error in POST /api/orders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}
