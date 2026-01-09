import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/loadlists/available-face-sheets
 * ดึงรายการ Face Sheets ที่ status = completed ทั้งหมด
 * ให้ผู้ใช้เลือกเองเพื่อตรวจสอบความถูกต้อง
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id');

    // Query face sheets ที่ status = completed ทั้งหมด (ไม่กรองที่ใช้แล้ว)
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

    // ดึงข้อมูลว่า face sheet ไหนถูกใช้ใน loadlist แล้ว
    const { data: usedFaceSheets } = await supabase
      .from('loadlist_face_sheets')
      .select('face_sheet_id, loadlist_id');

    const usedMap = new Map(usedFaceSheets?.map(lfs => [lfs.face_sheet_id, lfs.loadlist_id]) || []);

    // Enrich face sheets ด้วยข้อมูล trips และสถานะการใช้งาน
    const enrichedFaceSheets = await Promise.all(
      (faceSheets || []).map(async (fs) => {
        // ดึง packages ของ face sheet นี้
        const { data: packages } = await supabase
          .from('face_sheet_packages')
          .select('id, order_id')
          .eq('face_sheet_id', fs.id);

        const orderIds = [...new Set(packages?.map(p => p.order_id).filter(Boolean) || [])];

        let dailyTripNumbers: number[] = [];
        let dailyTripNumbersDisplay = '-';

        if (orderIds.length > 0) {
          // หา trips ที่เกี่ยวข้องกับ orders ใน face sheet
          const { data: stops } = await supabase
            .from('receiving_route_stops')
            .select('trip_id, order_id')
            .in('order_id', orderIds);

          if (stops && stops.length > 0) {
            const tripIds = [...new Set(stops.map(s => s.trip_id))];

            // ดึงข้อมูล trips
            const { data: trips } = await supabase
              .from('receiving_route_trips')
              .select('trip_id, daily_trip_number')
              .in('trip_id', tripIds);

            dailyTripNumbers = trips
              ?.map(t => t.daily_trip_number)
              .filter((n): n is number => n !== null)
              .sort((a, b) => a - b) || [];

            dailyTripNumbersDisplay = dailyTripNumbers.length > 0 
              ? dailyTripNumbers.join(', ') 
              : '-';
          }
        }

        const isUsed = usedMap.has(fs.id);
        const usedInLoadlistId = usedMap.get(fs.id);

        return {
          ...fs,
          daily_trip_numbers: dailyTripNumbers,
          daily_trip_numbers_display: dailyTripNumbersDisplay,
          is_used: isUsed,
          used_in_loadlist_id: usedInLoadlistId || null
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedFaceSheets,
      total: enrichedFaceSheets.length
    });

  } catch (error) {
    console.error('Error in available-face-sheets API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
