import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/loadlists/available-face-sheets
 * ดึงรายการ Face Sheets ที่พร้อมสร้าง Loadlist (status = completed)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id');

    // Query face sheets ที่ status = completed และยังไม่ได้อยู่ใน loadlist
    let query = supabase
      .from('face_sheets')
      .select(`
        id,
        face_sheet_no,
        status,
        warehouse_id,
        total_packages,
        total_items,
        total_orders,
        small_size_count,
        large_size_count,
        created_at,
        updated_at,
        picking_completed_at
      `)
      .eq('status', 'completed')
      .order('picking_completed_at', { ascending: false });

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data: faceSheets, error } = await query;

    if (error) {
      console.error('Error fetching available face sheets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch available face sheets', details: error.message },
        { status: 500 }
      );
    }

    // Filter out face sheets ที่อยู่ใน loadlist แล้ว
    const { data: usedFaceSheets } = await supabase
      .from('loadlist_face_sheets')
      .select('face_sheet_id');

    const usedIds = new Set(usedFaceSheets?.map(lfs => lfs.face_sheet_id) || []);
    const availableFaceSheets = faceSheets?.filter(fs => !usedIds.has(fs.id)) || [];

    return NextResponse.json({
      success: true,
      data: availableFaceSheets,
      total: availableFaceSheets.length
    });

  } catch (error) {
    console.error('Error in available-face-sheets API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
