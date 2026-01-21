import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/loadlists/available-picklists
 * Fetch picklists that are completed and not yet assigned to any loadlist
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว

    // Step 1: Get all picklist IDs that are already in loadlists
    const { data: loadlistPicklists, error: loadlistError } = await supabase
      .from('wms_loadlist_picklists')
      .select('picklist_id');

    if (loadlistError) {
      console.error('Error fetching loadlist picklists:', loadlistError);
      return NextResponse.json(
        { error: 'Failed to fetch loadlist picklists', details: loadlistError.message },
        { status: 500 }
      );
    }

    const usedPicklistIds = (loadlistPicklists || []).map((lp: any) => lp.picklist_id);

    // Step 2: Fetch completed picklists that are NOT in the used list
    // Note: voided picklists are already excluded by status='completed' filter
    const { data: picklists, error } = await supabase
      .from('picklists')
      .select(`
        id,
        picklist_code,
        status,
        total_lines,
        total_quantity,
        loading_door_number,
        created_at,
        trip:trip_id (
          trip_id,
          trip_code,
          vehicle_id,
          driver_id,
          vehicle:vehicle_id (
            plate_number,
            model
          ),
          driver:driver_id (
            first_name,
            last_name
          )
        )
      `, { count: 'exact' })
      .eq('status', 'completed')
      .not('id', 'in', `(${usedPicklistIds.length > 0 ? usedPicklistIds.join(',') : '0'})`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching picklists:', error);
      return NextResponse.json(
        { error: 'Failed to fetch available picklists', details: error.message },
        { status: 500 }
      );
    }

    // ✅ FIX: Don't filter - return all completed picklists that aren't in loadlists yet
    // The old filter was too strict (required Dispatch reservations which may not exist)
    const filteredPicklists = picklists || [];

    console.log(`[available-picklists] Total completed picklists available: ${filteredPicklists.length}`);

    // Step 3: Get trip IDs to fetch provinces (use filtered picklists)
    const tripIds = filteredPicklists
      .map((p: any) => p.trip?.trip_id)
      .filter((id: any) => id != null);

    // Step 4: Fetch provinces from stops if we have trip IDs
    let provinceMap: Record<number, string> = {};
    if (tripIds.length > 0) {
      const { data: stops } = await supabase
        .from('receiving_route_stops')
        .select('trip_id, order_id')
        .in('trip_id', tripIds)
        .order('sequence_no', { ascending: true });

      if (stops && stops.length > 0) {
        // Get unique order IDs
        const orderIds = [...new Set(stops.map((s: any) => s.order_id).filter((id: any) => id != null))];
        
        if (orderIds.length > 0) {
          const { data: orders } = await supabase
            .from('wms_orders')
            .select('order_id, province')
            .in('order_id', orderIds);

          // Create order to province map
          const orderProvinceMap: Record<number, string> = {};
          orders?.forEach((order: any) => {
            if (order.province) {
              orderProvinceMap[order.order_id] = order.province;
            }
          });

          // Map trip to provinces (collect all unique provinces)
          const tripProvinces: Record<number, Set<string>> = {};
          stops.forEach((stop: any) => {
            if (stop.trip_id && stop.order_id && orderProvinceMap[stop.order_id]) {
              if (!tripProvinces[stop.trip_id]) {
                tripProvinces[stop.trip_id] = new Set();
              }
              tripProvinces[stop.trip_id].add(orderProvinceMap[stop.order_id]);
            }
          });

          // Convert sets to comma-separated strings
          Object.keys(tripProvinces).forEach((tripId) => {
            provinceMap[Number(tripId)] = Array.from(tripProvinces[Number(tripId)]).join(', ');
          });
        }
      }
    }

    // Step 5: Get total stops and weight for each trip
    const tripStatsMap: Record<number, { stops: number; weight: number }> = {};
    if (tripIds.length > 0) {
      const { data: tripStats } = await supabase
        .from('receiving_route_trips')
        .select('trip_id, total_stops, total_weight_kg')
        .in('trip_id', tripIds);

      tripStats?.forEach((trip: any) => {
        if (trip.trip_id) {
          tripStatsMap[trip.trip_id] = {
            stops: trip.total_stops || 0,
            weight: trip.total_weight_kg || 0
          };
        }
      });
    }

    // Transform to match expected format (use filtered picklists)
    const transformedPicklists = filteredPicklists.map((picklist: any) => {
      const tripId = picklist.trip?.trip_id;
      const province = tripId ? (provinceMap[tripId] || '-') : '-';
      const tripStats = tripId ? tripStatsMap[tripId] : null;

      // Get driver name: prioritize employee name, fallback to vehicle model
      const driverName = picklist.trip?.driver
        ? `${picklist.trip.driver.first_name || ''} ${picklist.trip.driver.last_name || ''}`.trim()
        : picklist.trip?.vehicle?.model || '-';

      return {
        id: picklist.id,
        picklist_code: picklist.picklist_code,
        status: picklist.status,
        total_lines: picklist.total_lines || 0,
        total_quantity: picklist.total_quantity || 0,
        total_stops: tripStats?.stops || 0,
        total_weight: tripStats?.weight || 0,
        loading_door_number: picklist.loading_door_number,
        created_at: picklist.created_at,
        province: province,
        trip: {
          trip_id: picklist.trip?.trip_id,
          trip_code: picklist.trip?.trip_code || '-',
          vehicle_id: picklist.trip?.vehicle_id,
          driver_id: picklist.trip?.driver_id,
          vehicle: {
            plate_number: picklist.trip?.vehicle?.plate_number || '-'
          },
          driver_name: driverName
        }
      };
    });

    // ✅ REMOVED PAGINATION: ส่งข้อมูลทั้งหมดเพื่อความเร็ว
    return NextResponse.json({
      data: transformedPicklists
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
