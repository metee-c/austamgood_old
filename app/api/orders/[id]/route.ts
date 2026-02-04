import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function handlePatch(
  request: NextRequest,
  context: { params?: Promise<{ id: string }>; user: any }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params!;
    const body = await request.json();

    // Build update object from allowed fields
    const updateData: any = {};
    
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    
    if (body.delivery_date !== undefined) {
      updateData.delivery_date = body.delivery_date;
    }
    
    if (body.order_type !== undefined) {
      updateData.order_type = body.order_type;
    }

    if (body.text_field_long_1 !== undefined) {
      updateData.text_field_long_1 = body.text_field_long_1;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update order
    const { data, error } = await supabase
      .from('wms_orders')
      .update(updateData)
      .eq('order_id', parseInt(id))
      .select()
      .single();

    if (error) {
      console.error('Error updating order:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error in PATCH /api/orders/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleDelete(
  request: NextRequest,
  context: { params?: Promise<{ id: string }>; user: any }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params!;
    const orderId = parseInt(id);

    // 1. ตรวจสอบว่า order มีอยู่จริงและสถานะอนุญาตให้ลบได้
    const { data: order, error: fetchError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, status')
      .eq('order_id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // ไม่อนุญาตให้ลบ order ที่มีสถานะ completed หรือ shipped
    if (['completed', 'shipped', 'delivered'].includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot delete order with status: ${order.status}` },
        { status: 400 }
      );
    }

    // 2. ลบ order_items ก่อน (foreign key constraint)
    const { error: itemsError } = await supabase
      .from('wms_order_items')
      .delete()
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('Error deleting order items:', itemsError);
      return NextResponse.json(
        { error: `Failed to delete order items: ${itemsError.message}` },
        { status: 500 }
      );
    }

    // 3. ลบ order
    const { error: deleteError } = await supabase
      .from('wms_orders')
      .delete()
      .eq('order_id', orderId);

    if (deleteError) {
      console.error('Error deleting order:', deleteError);
      return NextResponse.json(
        { error: `Failed to delete order: ${deleteError.message}` },
        { status: 500 }
      );
    }

    console.log(`[DELETE] Order ${order.order_no} (ID: ${orderId}) deleted successfully`);

    return NextResponse.json({
      success: true,
      message: `Order ${order.order_no} deleted successfully`
    });

  } catch (error) {
    console.error('Error in DELETE /api/orders/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export with auth wrapper
export const PATCH = withShadowLog(withAuth(handlePatch));
export const DELETE = withShadowLog(withAuth(handleDelete));
