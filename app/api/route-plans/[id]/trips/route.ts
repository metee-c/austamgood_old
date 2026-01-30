import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: planId } = await params;

    // Fetch trips for this plan with stops data
    const { data: trips, error: tripsError } = await supabase
      .from('receiving_route_trips')
      .select(`
        *,
        stops:receiving_route_stops (
          stop_id,
          stop_name,
          sequence_no,
          order_id,
          order:wms_orders!fk_receiving_route_stops_order (
            order_id,
            order_no,
            shop_name,
            customer_id
          )
        )
      `)
      .eq('plan_id', planId)
      .order('trip_sequence', { ascending: true });

    if (tripsError) {
      console.error('Error fetching trips:', tripsError);
      return NextResponse.json(
        { data: null, error: tripsError.message },
        { status: 500 }
      );
    }

    // Process trips to add shop_names summary
    const processedTrips = (trips || []).map(trip => {
      const shopNames = (trip.stops || [])
        .map((stop: any) => stop.order?.shop_name || stop.stop_name)
        .filter(Boolean);
      
      // Remove duplicates and join
      const uniqueShopNames = [...new Set(shopNames)];
      
      return {
        ...trip,
        shop_names_summary: uniqueShopNames.join(' + '),
        stops_count: trip.stops?.length || 0
      };
    });

    return NextResponse.json({ data: processedTrips, error: null });
  } catch (error: any) {
    console.error('Error in trips API:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
