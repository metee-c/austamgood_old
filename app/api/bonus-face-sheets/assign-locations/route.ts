import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * POST /api/bonus-face-sheets/assign-locations
 * Auto-assign storage locations (PQ01-PQ10, MR01-MR10) to bonus face sheet packages
 * Max 10 packs per location
 */
async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    const { face_sheet_id } = body;

    if (!face_sheet_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ face_sheet_id' },
        { status: 400 }
      );
    }

    // Call the database function to assign locations
    const { data, error } = await supabase.rpc('assign_bonus_face_sheet_storage_locations', {
      p_face_sheet_id: face_sheet_id
    });

    if (error) {
      console.error('Error assigning storage locations:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get summary of assigned locations
    const { data: summary, error: summaryError } = await supabase.rpc(
      'get_bonus_face_sheet_storage_summary',
      { p_face_sheet_id: face_sheet_id }
    );

    if (summaryError) {
      console.error('Error getting storage summary:', summaryError);
    }

    return NextResponse.json({
      success: true,
      message: `จัดสรรโลเคชั่นสำเร็จ ${data?.length || 0} แพ็ค`,
      assigned_packages: data || [],
      location_summary: summary || []
    });
  } catch (error: any) {
    console.error('Error in POST /api/bonus-face-sheets/assign-locations:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bonus-face-sheets/assign-locations?face_sheet_id=xxx
 * Get storage location summary for a bonus face sheet
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const face_sheet_id = searchParams.get('face_sheet_id');

    if (!face_sheet_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ face_sheet_id' },
        { status: 400 }
      );
    }

    // Get summary of assigned locations
    const { data: summary, error: summaryError } = await supabase.rpc(
      'get_bonus_face_sheet_storage_summary',
      { p_face_sheet_id: parseInt(face_sheet_id) }
    );

    if (summaryError) {
      console.error('Error getting storage summary:', summaryError);
      return NextResponse.json(
        { success: false, error: summaryError.message },
        { status: 500 }
      );
    }

    // Get face sheet info
    const { data: faceSheet, error: fsError } = await supabase
      .from('bonus_face_sheets')
      .select('face_sheet_no, total_packages, created_date')
      .eq('id', face_sheet_id)
      .single();

    if (fsError) {
      console.error('Error getting face sheet:', fsError);
    }

    // Count packages with/without locations
    const { data: packages, error: pkgError } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, storage_location')
      .eq('face_sheet_id', face_sheet_id);

    const assignedCount = packages?.filter(p => p.storage_location).length || 0;
    const unassignedCount = packages?.filter(p => !p.storage_location).length || 0;

    return NextResponse.json({
      success: true,
      face_sheet: faceSheet,
      location_summary: summary || [],
      stats: {
        total_packages: packages?.length || 0,
        assigned_packages: assignedCount,
        unassigned_packages: unassignedCount
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/assign-locations:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
