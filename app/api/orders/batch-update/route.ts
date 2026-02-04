import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _PATCH(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();

    const { order_ids, order_type, delivery_date } = body;

    // Validate required fields
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { error: 'order_ids is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Build update object from allowed fields
    const updateData: any = {};
    
    if (order_type !== undefined) {
      // Validate order_type
      const validTypes = ['route_planning', 'express', 'special'];
      if (!validTypes.includes(order_type)) {
        return NextResponse.json(
          { error: `Invalid order_type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.order_type = order_type;
    }
    
    if (delivery_date !== undefined) {
      updateData.delivery_date = delivery_date;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update. Provide order_type or delivery_date.' },
        { status: 400 }
      );
    }

    // Update orders
    const { data, error } = await supabase
      .from('wms_orders')
      .update(updateData)
      .in('order_id', order_ids)
      .select('order_id, order_no, order_type, delivery_date');

    if (error) {
      console.error('Error batch updating orders:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `อัพเดท ${data?.length || 0} ออเดอร์สำเร็จ`,
      updated_count: data?.length || 0,
      data
    });

  } catch (error) {
    console.error('Error in PATCH /api/orders/batch-update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const PATCH = withShadowLog(_PATCH);
