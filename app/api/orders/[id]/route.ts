import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

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

// Export with auth wrapper
export const PATCH = withAuth(handlePatch);
