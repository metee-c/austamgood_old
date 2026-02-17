import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

// GET - Get a single contract with its trips
async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const contractId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const contractType = searchParams.get('type') || 'multi';

    if (isNaN(contractId)) {
      return NextResponse.json({ error: 'Invalid contract ID' }, { status: 400 });
    }

    let contract: any = null;

    if (contractType === 'single') {
      const { data, error } = await supabase
        .from('transport_contracts')
        .select(`
          *,
          plan:receiving_route_plans(plan_code, plan_name, plan_date)
        `)
        .eq('id', contractId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      contract = { ...data, contract_type: 'single' };
    } else {
      const { data, error } = await supabase
        .from('multi_plan_transport_contracts')
        .select('*')
        .eq('id', contractId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      contract = { ...data, contract_type: 'multi' };
    }

    // Get trips in this contract with full trip details
    const { data: tripJunctions, error: tripsError } = await supabase
      .from('transport_contract_trips')
      .select('trip_id')
      .eq('contract_id', contractId)
      .eq('contract_type', contractType);

    let trips: any[] = [];
    if (!tripsError && tripJunctions && tripJunctions.length > 0) {
      const tripIds = tripJunctions.map(t => t.trip_id);
      const { data: tripData, error: tripDataError } = await supabase
        .from('receiving_route_trips')
        .select('*')
        .in('trip_id', tripIds);
      
      if (!tripDataError && tripData) {
        trips = tripData;
      }
    }

    if (tripsError) {
      console.error('Error fetching contract trips:', tripsError);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...contract,
        trips: trips || []
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/transport-contracts/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a transport contract
async function _DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const contractId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const contractType = searchParams.get('type') || 'multi';

    if (isNaN(contractId)) {
      return NextResponse.json({ error: 'Invalid contract ID' }, { status: 400 });
    }

    // Optional: Check if contract is printed and warn
    let contract: any = null;
    if (contractType === 'single') {
      const { data } = await supabase
        .from('transport_contracts')
        .select('printed_at')
        .eq('id', contractId)
        .single();
      contract = data;
    } else {
      const { data } = await supabase
        .from('multi_plan_transport_contracts')
        .select('printed_at')
        .eq('id', contractId)
        .single();
      contract = data;
    }

    // Call RPC to delete contract (cascade to junction table)
    const { data, error } = await supabase.rpc('delete_transport_contract', {
      p_contract_id: contractId,
      p_contract_type: contractType
    });

    if (error) {
      console.error('Error deleting transport contract:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'ลบใบว่าจ้างสำเร็จ',
      was_printed: contract?.printed_at ? true : false
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/transport-contracts/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
export const DELETE = withShadowLog(_DELETE);
