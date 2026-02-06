import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';

/**
 * API endpoint สำหรับจัดลำดับจุดส่งใหม่ภายในเที่ยวเดียวกัน
 * รองรับการลาก (drag-and-drop) จุดส่งในแผนที่
 */
async function _PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: planId } = await params;
    const body = await request.json();

    const { tripId, orderedStopIds } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!tripId || !orderedStopIds || !Array.isArray(orderedStopIds)) {
      return NextResponse.json(
        { error: 'Missing required fields: tripId, orderedStopIds (array)' },
        { status: 400 }
      );
    }

    if (orderedStopIds.length === 0) {
      return NextResponse.json(
        { error: 'orderedStopIds cannot be empty' },
        { status: 400 }
      );
    }

    // ดึงข้อมูล stops ทั้งหมดในเที่ยวนี้
    const { data: existingStops, error: fetchError } = await supabase
      .from('receiving_route_stops')
      .select('stop_id, sequence_no')
      .eq('trip_id', tripId)
      .order('sequence_no', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!existingStops || existingStops.length === 0) {
      return NextResponse.json(
        { error: 'No stops found in the specified trip' },
        { status: 404 }
      );
    }

    // ตรวจสอบว่า orderedStopIds ครบถ้วนและถูกต้อง
    const existingStopIds = existingStops.map(s => s.stop_id);
    const orderedStopIdsSet = new Set(orderedStopIds);

    if (orderedStopIds.length !== existingStopIds.length) {
      return NextResponse.json(
        {
          error: 'Number of stops in orderedStopIds does not match trip stops',
          expected: existingStopIds.length,
          received: orderedStopIds.length
        },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าทุก stop_id ใน orderedStopIds มีอยู่ในเที่ยวจริง
    for (const stopId of orderedStopIds) {
      if (!existingStopIds.includes(stopId)) {
        return NextResponse.json(
          { error: `Stop ID ${stopId} does not belong to trip ${tripId}` },
          { status: 400 }
        );
      }
    }

    // อัพเดท sequence_no ตามลำดับใหม่
    // ใช้ 2-phase update เพื่อหลีกเลี่ยง unique constraint violation

    // Phase 1: Set sequence_no เป็นค่าสูงมาก (temporary) เพื่อเลี่ยง constraint
    // ใช้ offset 10000 เพื่อให้แน่ใจว่าไม่ซ้ำกับลำดับจริง
    const tempOffset = 10000;
    const tempUpdates = orderedStopIds.map((stopId, index) => ({
      stop_id: stopId,
      temp_sequence: tempOffset + index + 1,
    }));

    for (const update of tempUpdates) {
      const { error } = await supabase
        .from('receiving_route_stops')
        .update({ sequence_no: update.temp_sequence })
        .eq('stop_id', update.stop_id);

      if (error) {
        console.error('Phase 1 error:', error);
        return NextResponse.json(
          { error: `Failed to set temporary sequence: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Phase 2: Update เป็นค่าจริง (positive values)
    const finalUpdates = orderedStopIds.map((stopId, index) => ({
      stop_id: stopId,
      sequence_no: index + 1,
      updated_at: new Date().toISOString()
    }));

    for (const update of finalUpdates) {
      const { error } = await supabase
        .from('receiving_route_stops')
        .update({
          sequence_no: update.sequence_no,
          updated_at: update.updated_at
        })
        .eq('stop_id', update.stop_id);

      if (error) {
        console.error('Phase 2 error:', error);
        return NextResponse.json(
          { error: `Failed to update final sequence: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Calculate new distance after reordering stops using optimized route (nearest to farthest)
    const { data: distanceData } = await supabase.rpc('calculate_trip_distance_optimized', {
      p_trip_id: tripId
    });
    const totalDistance = distanceData || 0;
    const totalDriveMinutes = Math.round(totalDistance * 1.2);

    await supabase
      .from('receiving_route_trips')
      .update({
        total_distance_km: totalDistance,
        total_drive_minutes: totalDriveMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq('trip_id', tripId);

    return NextResponse.json({
      success: true,
      message: 'Stops reordered successfully',
      data: {
        tripId,
        updatedStops: finalUpdates.length,
        newOrder: orderedStopIds,
        totalDistanceKm: totalDistance,
        totalDriveMinutes: totalDriveMinutes,
      }
    });

  } catch (error: any) {
    console.error('Error reordering stops:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const PUT = withShadowLog(_PUT);
