import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/trip-counts?bonus_face_sheet_id=xxx
 * คืนค่าจำนวน bonus packages แยกตาม trip_number
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const bonusFaceSheetId = searchParams.get('bonus_face_sheet_id');

    if (!bonusFaceSheetId) {
      return NextResponse.json({ error: 'bonus_face_sheet_id is required' }, { status: 400 });
    }

    const bonusFaceSheetIdNum = parseInt(bonusFaceSheetId);
    if (isNaN(bonusFaceSheetIdNum)) {
      return NextResponse.json({ error: 'Invalid bonus_face_sheet_id' }, { status: 400 });
    }

    // ดึง packages พร้อม trip_number
    const { data: packages, error: packagesError } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, order_id, trip_number')
      .eq('face_sheet_id', bonusFaceSheetIdNum);

    if (packagesError) {
      console.error('Error fetching bonus packages:', packagesError);
      return NextResponse.json({ error: 'Failed to fetch bonus packages' }, { status: 500 });
    }

    // Group by trip_number
    const tripCounts: Record<string, { packageCount: number; orderCount: number; orderIds: number[] }> = {};

    (packages || []).forEach(pkg => {
      const tripNumber = pkg.trip_number || 'NO_TRIP';
      if (!tripCounts[tripNumber]) {
        tripCounts[tripNumber] = { packageCount: 0, orderCount: 0, orderIds: [] };
      }
      tripCounts[tripNumber].packageCount++;
      if (pkg.order_id && !tripCounts[tripNumber].orderIds.includes(pkg.order_id)) {
        tripCounts[tripNumber].orderIds.push(pkg.order_id);
      }
    });

    // Calculate orderCount from unique orderIds
    Object.keys(tripCounts).forEach(tripNumber => {
      tripCounts[tripNumber].orderCount = tripCounts[tripNumber].orderIds.length;
      // Remove orderIds from response (not needed by frontend)
      delete (tripCounts[tripNumber] as any).orderIds;
    });

    // Sort by trip_number
    const sortedTrips = Object.entries(tripCounts)
      .sort(([a], [b]) => {
        // Put NO_TRIP and empty string at the end
        if (a === 'NO_TRIP' || a === '') return 1;
        if (b === 'NO_TRIP' || b === '') return -1;
        return a.localeCompare(b);
      })
      .map(([tripNumber, counts]) => ({
        trip_number: tripNumber || 'ไม่ระบุสายรถ',
        trip_number_raw: tripNumber, // เก็บค่าจริงสำหรับ filter
        ...counts
      }));

    return NextResponse.json({
      success: true,
      data: sortedTrips
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/trip-counts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
