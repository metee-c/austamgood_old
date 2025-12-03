import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/loadlists/available-bonus-face-sheets
 * ดึงรายการ Bonus Face Sheets ที่พร้อมสร้าง Loadlist (status = completed)
 * Copy logic จาก available-face-sheets
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id');

    // Query bonus face sheets ที่ status = completed และยังไม่ได้อยู่ใน loadlist
    let query = supabase
      .from('bonus_face_sheets')
      .select(`
        id,
        face_sheet_no,
        status,
        warehouse_id,
        total_packages,
        total_items,
        total_orders,
        created_at,
        updated_at,
        picking_completed_at
      `)
      .eq('status', 'completed')
      .order('picking_completed_at', { ascending: false });

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data: bonusFaceSheets, error } = await query;

    if (error) {
      console.error('Error fetching available bonus face sheets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch available bonus face sheets', details: error.message },
        { status: 500 }
      );
    }

    // Filter out bonus face sheets ที่อยู่ใน loadlist แล้ว
    const { data: usedBonusFaceSheets } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('bonus_face_sheet_id');

    const usedIds = new Set(usedBonusFaceSheets?.map(lbfs => lbfs.bonus_face_sheet_id) || []);
    const availableBonusFaceSheets = bonusFaceSheets?.filter(bfs => !usedIds.has(bfs.id)) || [];

    return NextResponse.json({
      success: true,
      data: availableBonusFaceSheets,
      total: availableBonusFaceSheets.length
    });

  } catch (error) {
    console.error('Error in available-bonus-face-sheets API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
