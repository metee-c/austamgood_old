import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { loadlist_id, picklist_id, scanned_code } = body;

    if (!loadlist_id || !picklist_id || !scanned_code) {
      return NextResponse.json(
        { error: 'loadlist_id, picklist_id, and scanned_code are required' },
        { status: 400 }
      );
    }

    // Verify the picklist belongs to this loadlist
    const { data: loadlistPicklist, error: verifyError } = await supabase
      .from('wms_loadlist_picklists')
      .select('*')
      .eq('loadlist_id', loadlist_id)
      .eq('picklist_id', picklist_id)
      .single();

    if (verifyError || !loadlistPicklist) {
      return NextResponse.json(
        { error: 'Picklist not found in this loadlist', details: verifyError?.message },
        { status: 404 }
      );
    }

    // Get picklist details to verify the scanned code
    const { data: picklist, error: picklistError } = await supabase
      .from('wms_picklists')
      .select('picklist_code, status')
      .eq('picklist_id', picklist_id)
      .single();

    if (picklistError || !picklist) {
      return NextResponse.json(
        { error: 'Picklist not found', details: picklistError?.message },
        { status: 404 }
      );
    }

    // Verify the scanned code matches the picklist code
    if (picklist.picklist_code.toUpperCase() !== scanned_code.toUpperCase()) {
      return NextResponse.json(
        { error: 'Scanned code does not match picklist code', details: 'Invalid QR code' },
        { status: 400 }
      );
    }

    // Check if picklist is completed
    if (picklist.status !== 'completed') {
      return NextResponse.json(
        { error: 'Picklist is not ready for loading', details: 'Picklist status: ' + picklist.status },
        { status: 400 }
      );
    }

    // Check if already loaded
    const { data: existingStatus, error: statusError } = await supabase
      .from('wms_picklist_loading_status')
      .select('is_loaded')
      .eq('picklist_id', picklist_id)
      .single();

    if (statusError && statusError.code !== 'PGRST116') { // PGRST116 = not found
      return NextResponse.json(
        { error: 'Failed to check loading status', details: statusError.message },
        { status: 500 }
      );
    }

    if (existingStatus?.is_loaded) {
      return NextResponse.json(
        { error: 'Picklist already loaded', details: 'This picklist has already been loaded' },
        { status: 400 }
      );
    }

    // Update or insert loading status
    const { error: updateError } = await supabase
      .from('wms_picklist_loading_status')
      .upsert({
        picklist_id: picklist_id,
        is_loaded: true,
        loaded_at: new Date().toISOString(),
        loaded_by: 'Mobile User' // In real app, get from auth
      });

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update loading status', details: updateError.message },
        { status: 500 }
      );
    }

    // Update loadlist status to 'loading' if it's still 'pending'
    const { error: loadlistStatusError } = await supabase
      .from('wms_loadlists')
      .update({ 
        status: 'loading',
        updated_at: new Date().toISOString()
      })
      .eq('loadlist_id', loadlist_id)
      .eq('status', 'pending');

    if (loadlistStatusError) {
      console.error('Failed to update loadlist status:', loadlistStatusError);
      // Don't return error here as the main operation succeeded
    }

    return NextResponse.json({ 
      success: true,
      message: 'Picklist loaded successfully'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
