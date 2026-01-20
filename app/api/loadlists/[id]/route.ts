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

/**
 * DELETE /api/loadlists/[id]
 * Delete a pending loadlist and its mappings
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    console.log('🗑️ Deleting loadlist:', id);

    // 1. Check loadlist status first
    const { data: loadlist, error: fetchError } = await supabase
      .from('loadlists')
      .select('status, loadlist_code')
      .eq('id', id)
      .single();

    if (fetchError || !loadlist) {
      return NextResponse.json(
        { error: 'Loadlist not found' },
        { status: 404 }
      );
    }

    if (loadlist.status === 'loaded') {
      return NextResponse.json(
        { error: 'Cannot delete a loaded loadlist. Please cancel or unload first.' },
        { status: 400 }
      );
    }

    // 2. Delete mappings first (wms_loadlist_picklists, loadlist_face_sheets, wms_loadlist_bonus_face_sheets)
    // Note: CASCADE constraints usually handle this, but being explicit is safer

    // Delete Picklist mappings
    const { error: delPicklistsC } = await supabase
      .from('wms_loadlist_picklists')
      .delete()
      .eq('loadlist_id', id);

    if (delPicklistsC) console.error('Error deleting picklist mappings:', delPicklistsC);

    // Delete Face Sheet mappings
    const { error: delFS } = await supabase
      .from('loadlist_face_sheets')
      .delete()
      .eq('loadlist_id', id);

    if (delFS) console.error('Error deleting face sheet mappings:', delFS);

    // Delete Bonus Face Sheet mappings
    const { error: delBFS } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .delete()
      .eq('loadlist_id', id);

    if (delBFS) console.error('Error deleting BFS mappings:', delBFS);

    // 3. Delete the loadlist itself
    const { error: delError } = await supabase
      .from('loadlists')
      .delete()
      .eq('id', id);

    if (delError) {
      console.error('❌ Error deleting loadlist:', delError);
      return NextResponse.json(
        { error: `Failed to delete loadlist: ${delError.message}` },
        { status: 500 }
      );
    }

    console.log(`✅ Loadlist ${loadlist.loadlist_code} deleted successfully`);

    return NextResponse.json({
      success: true,
      message: `Loadlist ${loadlist.loadlist_code} deleted successfully`
    });

  } catch (error) {
    console.error('❌ API Error in DELETE /api/loadlists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
