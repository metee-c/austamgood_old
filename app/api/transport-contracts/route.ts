import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

// GET - Get transport contracts (single, multi, or all)
// Query params: type, supplier_id, start_date, end_date, plan_id
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const contractType = searchParams.get('type'); // 'single' | 'multi' | 'all'
    const supplierId = searchParams.get('supplier_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const planId = searchParams.get('plan_id');

    let singleContracts: any[] = [];
    let multiContracts: any[] = [];

    // Fetch single plan contracts if requested
    // Only show contracts that have junction records (created from this page)
    if (!contractType || contractType === 'single' || contractType === 'all') {
      // First get IDs of single contracts that have junction records
      const { data: trackedSingleIds } = await supabase
        .from('transport_contract_trips')
        .select('contract_id')
        .eq('contract_type', 'single');

      const singleIdsWithTrips = [...new Set((trackedSingleIds || []).map((r: any) => r.contract_id))];

      if (singleIdsWithTrips.length > 0) {
        let singleQuery = supabase
          .from('transport_contracts')
          .select(`
            id, contract_no, plan_id, supplier_id, supplier_name,
            contract_date, total_trips, total_cost, printed_at, printed_by, created_at,
            plan:receiving_route_plans(plan_code, plan_name, plan_date)
          `)
          .in('id', singleIdsWithTrips);

        if (supplierId) {
          singleQuery = singleQuery.eq('supplier_id', supplierId);
        }
        if (planId) {
          singleQuery = singleQuery.eq('plan_id', planId);
        }
        if (startDate) {
          singleQuery = singleQuery.gte('contract_date', startDate);
        }
        if (endDate) {
          singleQuery = singleQuery.lte('contract_date', endDate);
        }

        const { data, error } = await singleQuery.order('created_at', { ascending: false });

        if (!error && data) {
          singleContracts = data.map((c: any) => ({ ...c, contract_type: 'single' }));
        }
      }
    }

    // Fetch multi plan contracts if requested
    if (!contractType || contractType === 'multi' || contractType === 'all') {
      let multiQuery = supabase
        .from('multi_plan_transport_contracts')
        .select('*');

      if (supplierId) {
        multiQuery = multiQuery.eq('supplier_id', supplierId);
      }
      if (startDate) {
        multiQuery = multiQuery.gte('contract_date', startDate);
      }
      if (endDate) {
        multiQuery = multiQuery.lte('contract_date', endDate);
      }

      const { data, error } = await multiQuery.order('created_at', { ascending: false });

      if (!error && data) {
        multiContracts = data.map((c: any) => ({ ...c, contract_type: 'multi' }));
      }
    }

    // Combine and sort by created_at desc
    const allContracts = [...singleContracts, ...multiContracts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ success: true, data: allContracts });
  } catch (error: any) {
    console.error('Error in GET /api/transport-contracts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function _POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { 
      plan_id, 
      supplier_id, 
      supplier_name, 
      total_trips, 
      total_cost, 
      printed_by,
      // Multi-plan support
      is_multi_plan,
      plan_ids,
      plan_codes,
      trip_ids,
      contract_date
    } = body;

    // Multi-plan contract
    if (is_multi_plan && plan_ids && plan_ids.length > 0) {
      if (!supplier_id) {
        return NextResponse.json(
          { error: 'supplier_id is required for multi-plan contract' },
          { status: 400 }
        );
      }

      // Validate: Check if any trips are already in other contracts
      if (trip_ids && trip_ids.length > 0) {
        const { data: existingTrips, error: checkError } = await supabase
          .from('transport_contract_trips')
          .select('trip_id, contract_id, contract_type')
          .in('trip_id', trip_ids);

        if (checkError) {
          console.error('Error checking existing trips:', checkError);
          return NextResponse.json({ error: checkError.message }, { status: 500 });
        }

        if (existingTrips && existingTrips.length > 0) {
          return NextResponse.json({
            error: 'มีบางคันอยู่ในใบว่าจ้างอื่นแล้ว',
            conflicting_trips: existingTrips
          }, { status: 400 });
        }
      }

      // Call the stored function to create multi-plan contract
      const { data, error } = await supabase.rpc('create_multi_plan_transport_contract', {
        p_plan_ids: plan_ids,
        p_plan_codes: plan_codes || [],
        p_trip_ids: trip_ids || [], 
        p_supplier_id: supplier_id,
        p_supplier_name: supplier_name || null,
        p_contract_date: contract_date || new Date().toISOString().split('T')[0],
        p_total_trips: total_trips || (trip_ids ? trip_ids.length : 0),
        p_total_cost: total_cost || 0,
        p_printed_by: printed_by || null,
      });

      if (error) {
        console.error('Error creating multi-plan transport contract:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const contract = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ data: contract });
    }

    // Single plan contract (original logic)
    if (!plan_id || !supplier_id) {
      return NextResponse.json(
        { error: 'plan_id and supplier_id are required' },
        { status: 400 }
      );
    }

    // For single plan, also validate trips if provided
    if (trip_ids && trip_ids.length > 0) {
      const { data: existingTrips, error: checkError } = await supabase
        .from('transport_contract_trips')
        .select('trip_id, contract_id, contract_type')
        .in('trip_id', trip_ids);

      if (checkError) {
        console.error('Error checking existing trips:', checkError);
        return NextResponse.json({ error: checkError.message }, { status: 500 });
      }

      if (existingTrips && existingTrips.length > 0) {
        return NextResponse.json({
          error: 'มีบางคันอยู่ในใบว่าจ้างอื่นแล้ว',
          conflicting_trips: existingTrips
        }, { status: 400 });
      }
    }

    // Check if custom contract_date is provided
    let contract: any;

    if (contract_date) {
      // ✅ Custom contract_date: bypass RPC and create directly
      // Check if contract already exists for this plan + supplier
      const { data: existing } = await supabase
        .from('transport_contracts')
        .select('*')
        .eq('plan_id', plan_id)
        .eq('supplier_id', supplier_id)
        .maybeSingle();

      if (existing) {
        contract = { ...existing, is_new: false };
      } else {
        // Generate contract number: TC-YYYYMMDD-XXX
        const dateStr = contract_date.replace(/-/g, '');
        const { count } = await supabase
          .from('transport_contracts')
          .select('*', { count: 'exact', head: true })
          .eq('contract_date', contract_date);

        const seq = (count || 0) + 1;
        const contractNo = `TC-${dateStr}-${String(seq).padStart(3, '0')}`;

        const { data: inserted, error: insertError } = await supabase
          .from('transport_contracts')
          .insert({
            contract_no: contractNo,
            plan_id,
            supplier_id,
            supplier_name: supplier_name || null,
            contract_date,
            total_trips: total_trips || 0,
            total_cost: total_cost || 0,
            printed_at: new Date().toISOString(),
            printed_by: printed_by || null,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating transport contract:', insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        contract = { ...inserted, is_new: true };
      }
    } else {
      // Original logic: use RPC with plan_date
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

      contract = Array.isArray(data) ? data[0] : data;
    }

    // Insert junction records for single plan if trip_ids provided
    if (trip_ids && trip_ids.length > 0 && contract && contract.id) {
      const junctionRecords = trip_ids.map((tripId: number) => ({
        contract_id: contract.id,
        contract_type: 'single',
        trip_id: tripId,
        plan_id: plan_id,
        supplier_id: supplier_id,
      }));

      const { error: junctionError } = await supabase
        .from('transport_contract_trips')
        .insert(junctionRecords);

      if (junctionError) {
        console.error('Error creating junction records:', junctionError);
        // Don't fail the whole request, just log the error
      }
    }

    return NextResponse.json({ data: contract });
  } catch (error: any) {
    console.error('Error in POST /api/transport-contracts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
