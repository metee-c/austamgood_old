import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: planId } = await params;

    const { data, error } = await supabase
      .from('receiving_route_plans')
      .select(`
        *,
        warehouse:master_warehouse!fk_receiving_route_plans_warehouse (
          warehouse_id,
          warehouse_name
        )
      `)
      .eq('plan_id', planId)
      .single();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    console.error('Error fetching route plan:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id: planId } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('receiving_route_plans')
      .update(body)
      .eq('plan_id', planId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    // If status changed to 'published', update all orders in this plan to 'confirmed'
    if (body.status === 'published') {
      // Get all orders in this route plan
      const { data: planInputs, error: ordersError } = await supabase
        .from('receiving_route_plan_inputs')
        .select('order_id')
        .eq('plan_id', planId)
        .not('order_id', 'is', null);

      if (ordersError) {
        console.error('Error fetching plan inputs:', ordersError);
      } else if (planInputs && planInputs.length > 0) {
        // Get unique order IDs (remove duplicates)
        const orderIds = [...new Set(planInputs.map(pi => pi.order_id))];

        // Update order status to 'confirmed'
        const { error: updateError } = await supabase
          .from('wms_orders')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString()
          })
          .in('order_id', orderIds)
          .eq('status', 'draft'); // Only update orders that are still in draft status

        if (updateError) {
          console.error('Error updating order statuses:', updateError);
        }
      }
    }

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    console.error('Error updating route plan:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
