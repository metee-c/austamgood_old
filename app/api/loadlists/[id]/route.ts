import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PUT /api/loadlists/[id]
 * Update loadlist fields (vehicle_id, driver_employee_id, loading_queue_number, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    console.log('📝 Updating loadlist:', { id, body });

    // Update loadlist
    const { data, error } = await supabase
      .from('loadlists')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating loadlist:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Loadlist updated successfully:', data);

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ API Error in PUT /api/loadlists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/loadlists/[id]
 * Update loadlist by loadlist_code
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    console.log('📝 Updating loadlist by code:', { code: id, body });

    // Update loadlist by loadlist_code
    const { data, error } = await supabase
      .from('loadlists')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('loadlist_code', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating loadlist:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Loadlist updated successfully:', data);

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ API Error in PATCH /api/loadlists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
