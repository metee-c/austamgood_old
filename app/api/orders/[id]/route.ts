import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteClient();
    const { id: orderId } = await params;

    const { data, error } = await supabase
      .from('wms_orders')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('API Error in GET /api/orders/[id]:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteClient();
    const { id: orderId } = await params;
    const body = await request.json();

    // Update order header
    const { data: orderData, error: orderError } = await supabase
      .from('wms_orders')
      .update({
        order_type: body.order_type,
        customer_id: body.customer_id,
        order_date: body.order_date,
        delivery_date: body.delivery_date,
        status: body.status,
        total_amount: body.total_amount,
        shipping_address: body.shipping_address,
        delivery_instructions: body.delivery_instructions,
        notes: body.notes,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (orderError) {
      console.error('Error updating order:', orderError);
      return NextResponse.json(
        { data: null, error: orderError.message },
        { status: 500 }
      );
    }

    // If items are provided, update them
    if (body.items && body.items.length > 0) {
      // Delete existing items
      await supabase
        .from('wms_order_items')
        .delete()
        .eq('order_id', orderId);

      // Insert new items
      const orderItems = body.items.map((item: any) => ({
        order_id: orderId,
        sku_id: item.sku_id,
        ordered_qty: item.ordered_qty,
        picked_qty: item.picked_qty || 0,
        shipped_qty: item.shipped_qty || 0,
        unit_price: item.unit_price,
        line_total: item.ordered_qty * item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from('wms_order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error updating order items:', itemsError);
        return NextResponse.json(
          { data: null, error: itemsError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ data: orderData, error: null });
  } catch (error) {
    console.error('API Error in PUT /api/orders/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteClient();
    const { id: orderId } = await params;
    const body = await request.json();

    // Update only the fields provided in the request body
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Add only the fields that are present in the request body
    if (body.order_type !== undefined) updateData.order_type = body.order_type;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.delivery_date !== undefined) updateData.delivery_date = body.delivery_date;
    if (body.customer_id !== undefined) updateData.customer_id = body.customer_id;
    if (body.order_date !== undefined) updateData.order_date = body.order_date;
    if (body.total_amount !== undefined) updateData.total_amount = body.total_amount;
    if (body.shipping_address !== undefined) updateData.shipping_address = body.shipping_address;
    if (body.delivery_instructions !== undefined) updateData.delivery_instructions = body.delivery_instructions;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const { data, error } = await supabase
      .from('wms_orders')
      .update(updateData)
      .eq('order_id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error updating order:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('API Error in PATCH /api/orders/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteClient();
    const { id: orderId } = await params;

    // Delete order items first (foreign key constraint)
    await supabase
      .from('wms_order_items')
      .delete()
      .eq('order_id', orderId);

    // Delete order
    const { error } = await supabase
      .from('wms_orders')
      .delete()
      .eq('order_id', orderId);

    if (error) {
      console.error('Error deleting order:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error('API Error in DELETE /api/orders/[id]:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
