import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    const { loadlist_id, picklist_id } = body;

    if (!loadlist_id || !picklist_id) {
      return NextResponse.json(
        { error: 'loadlist_id and picklist_id are required' },
        { status: 400 }
      );
    }

    // 1. Verify picklist belongs to this loadlist
    const { data: loadlistPicklist, error: verifyError } = await supabase
      .from('wms_loadlist_picklists')
      .select('id, loaded_at')
      .eq('loadlist_id', loadlist_id)
      .eq('picklist_id', picklist_id)
      .single();

    if (verifyError || !loadlistPicklist) {
      return NextResponse.json(
        { error: 'Picklist not found in this loadlist' },
        { status: 404 }
      );
    }

    // 2. Check if already loaded
    if (loadlistPicklist.loaded_at) {
      return NextResponse.json(
        { error: 'Picklist already loaded', details: 'This picklist has already been loaded' },
        { status: 400 }
      );
    }

    // 3. Update loaded_at timestamp
    const { error: updateError } = await supabase
      .from('wms_loadlist_picklists')
      .update({
        loaded_at: new Date().toISOString(),
        loaded_by_employee_id: null // TODO: Get from auth session
      })
      .eq('id', loadlistPicklist.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update picklist', details: updateError.message },
        { status: 500 }
      );
    }

    // Status remains 'pending' until complete button is clicked
    return NextResponse.json({
      success: true,
      message: 'Picklist marked as loaded successfully'
    });

  } catch (error) {
    console.error('API error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
