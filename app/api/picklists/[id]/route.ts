import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/picklists/[id]
 * 6I-!9% Picklist by ID #I-!#2"%0@-5"1I+!
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from('picklists')
      .select(`
        *,
        receiving_route_trips (
          trip_id,
          trip_sequence,
          vehicle_id,
          receiving_route_plans (
            plan_id,
            plan_code,
            plan_name
          )
        ),
        picklist_items (
          id,
          sku_id,
          product_name,
          quantity,
          picked_quantity,
          master_sku (
            sku_name,
            barcode
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching picklist:', error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('API Error in GET /api/picklists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/picklists/[id]
 * -1@I-!9% Picklist (*3+#1AID*20+#7-I-!9%-7HF)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    // -1@I-!9%
    const { data, error } = await supabase
      .from('picklists')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating picklist:', error);
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
    console.error('API Error in PATCH /api/picklists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/picklists/[id]
 * % Picklist (@%5H"*20@G cancelled)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // @%5H"*20@G cancelled A2#%#4
    const { data, error } = await supabase
      .from('picklists')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling picklist:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Picklist cancelled successfully',
      data
    });

  } catch (error) {
    console.error('API Error in DELETE /api/picklists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
