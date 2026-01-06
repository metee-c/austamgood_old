import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get transport contract by plan_id and supplier_id
// POST - Create or get transport contract
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('plan_id');
    const supplierId = searchParams.get('supplier_id');

    if (!planId) {
      return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
    }

    let query = supabase
      .from('transport_contracts')
      .select('*')
      .eq('plan_id', planId);

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transport contracts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in GET /api/transport-contracts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { plan_id, supplier_id, supplier_name, total_trips, total_cost, printed_by } = body;

    if (!plan_id || !supplier_id) {
      return NextResponse.json(
        { error: 'plan_id and supplier_id are required' },
        { status: 400 }
      );
    }

    // Call the stored function to get or create contract
    const { data, error } = await supabase.rpc('get_or_create_transport_contract', {
      p_plan_id: plan_id,
      p_supplier_id: supplier_id,
      p_supplier_name: supplier_name || null,
      p_total_trips: total_trips || 0,
      p_total_cost: total_cost || 0,
      p_printed_by: printed_by || null,
    });

    if (error) {
      console.error('Error creating transport contract:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // data is an array from the function, get first item
    const contract = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({ data: contract });
  } catch (error: any) {
    console.error('Error in POST /api/transport-contracts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
