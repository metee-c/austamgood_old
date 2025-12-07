import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const loadlist_id = searchParams.get('loadlist_id');

    if (!loadlist_id) {
      return NextResponse.json(
        { error: 'loadlist_id is required' },
        { status: 400 }
      );
    }

    // Get picklists in this loadlist
    const { data: loadlistPicklists, error: picklistError } = await supabase
      .from('wms_loadlist_picklists')
      .select(`
        picklist_id,
        added_at,
        picklists:picklist_id (
          id,
          picklist_code,
          status,
          total_lines,
          trip_id,
          trip:trip_id (
            trip_code,
            vehicle:vehicle_id (
              plate_number
            )
          )
        )
      `)
      .eq('loadlist_id', loadlist_id);

    if (picklistError) {
      console.error('Picklist error:', picklistError);
    }

    // Get face sheets in this loadlist
    const { data: loadlistFaceSheets, error: faceSheetError } = await supabase
      .from('loadlist_face_sheets')
      .select(`
        face_sheet_id,
        added_at,
        face_sheets:face_sheet_id (
          id,
          face_sheet_no,
          status,
          total_packages,
          total_items
        )
      `)
      .eq('loadlist_id', loadlist_id);

    if (faceSheetError) {
      console.error('Face sheet error:', faceSheetError);
    }

    // Transform picklist data
    const picklistItems = loadlistPicklists?.map((item: any) => ({
      id: item.picklist_id,
      type: 'picklist',
      code: item.picklists?.picklist_code || '',
      status: item.picklists?.status || 'pending',
      total_lines: item.picklists?.total_lines || 0,
      trip_code: item.picklists?.trip?.trip_code || '',
      vehicle_plate: item.picklists?.trip?.vehicle?.plate_number || '',
      is_loaded: false,
      added_at: item.added_at
    })) || [];

    // Transform face sheet data
    const faceSheetItems = loadlistFaceSheets?.map((item: any) => ({
      id: item.face_sheet_id,
      type: 'face_sheet',
      code: item.face_sheets?.face_sheet_no || '',
      status: item.face_sheets?.status || 'generated',
      total_lines: item.face_sheets?.total_packages || 0,
      total_items: item.face_sheets?.total_items || 0,
      trip_code: '',
      vehicle_plate: '',
      is_loaded: false,
      added_at: item.added_at
    })) || [];

    // Combine both types
    const items = [...picklistItems, ...faceSheetItems].sort((a, b) => 
      new Date(a.added_at).getTime() - new Date(b.added_at).getTime()
    );

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
