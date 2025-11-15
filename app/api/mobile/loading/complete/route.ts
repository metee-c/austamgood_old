import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { loadlist_id } = body;

    if (!loadlist_id) {
      return NextResponse.json(
        { error: 'loadlist_id is required' },
        { status: 400 }
      );
    }

    // Get all picklists in this loadlist
    const { data: loadlistPicklists, error: picklistsError } = await supabase
      .from('wms_loadlist_picklists')
      .select(`
        picklist_id,
        wms_picklist_loading_status (
          is_loaded
        )
      `)
      .eq('loadlist_id', loadlist_id);

    if (picklistsError) {
      return NextResponse.json(
        { error: 'Failed to fetch loadlist picklists', details: picklistsError.message },
        { status: 500 }
      );
    }

    // Check if all picklists are loaded
    const allLoaded = loadlistPicklists?.every(
      item => item.wms_picklist_loading_status?.[0]?.is_loaded
    );

    if (!allLoaded) {
      return NextResponse.json(
        { error: 'Not all picklists are loaded', details: 'Please load all picklists before completing' },
        { status: 400 }
      );
    }

    // Update loadlist status to 'loaded'
    const { error: updateError } = await supabase
      .from('wms_loadlists')
      .update({ 
        status: 'loaded',
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('loadlist_id', loadlist_id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update loadlist status', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Loadlist completed successfully'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
