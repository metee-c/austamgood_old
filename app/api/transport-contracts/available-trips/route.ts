import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

// GET - Get available trips that are NOT in any transport contract
// Query params: plan_id, supplier_id
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('plan_id');
    const supplierId = searchParams.get('supplier_id');

    if (!planId) {
      return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
    }

    // Query trips that don't have a junction record (not in any contract)
    // Using NOT EXISTS for better performance
    let query = supabase
      .from('receiving_route_trips')
      .select(`
        *,
        plan:receiving_route_plans(plan_code, plan_name, plan_date),
        supplier:master_supplier(supplier_id, supplier_name)
      `)
      .eq('plan_id', planId)
      .order('daily_trip_number', { ascending: true });

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data: allTrips, error } = await query;

    if (error) {
      console.error('Error fetching trips:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get all trip_ids that are already in contracts
    const tripIds = allTrips?.map((t: any) => t.trip_id) || [];

    if (tripIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data: contractedTrips, error: contractError } = await supabase
      .from('transport_contract_trips')
      .select('trip_id, contract_id, contract_type')
      .in('trip_id', tripIds);

    if (contractError) {
      console.error('Error fetching contracted trips:', contractError);
      return NextResponse.json({ error: contractError.message }, { status: 500 });
    }

    // Filter out trips that are already in contracts
    const contractedTripIds = new Set(contractedTrips?.map((ct: any) => ct.trip_id) || []);
    const availableTrips = allTrips?.filter((trip: any) => !contractedTripIds.has(trip.trip_id)) || [];

    return NextResponse.json({ success: true, data: availableTrips });
  } catch (error: any) {
    console.error('Error in GET /api/transport-contracts/available-trips:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
