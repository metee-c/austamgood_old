import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    // Fetch route plans with warehouse data
    let query = supabase
      .from('receiving_route_plans')
      .select(`
        *,
        warehouse:master_warehouse!fk_receiving_route_plans_warehouse (
          warehouse_id,
          warehouse_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching route plans:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    console.log('Route plans fetched successfully:', {
      count: data?.length || 0,
      plans: data?.slice(0, 3).map(p => ({
        plan_id: p.plan_id,
        plan_code: p.plan_code,
        status: p.status,
        warehouse_id: p.warehouse_id,
        warehouse_name: p.warehouse?.warehouse_name
      }))
    });

    return NextResponse.json({ data: data || [], error: null });
  } catch (error) {
    console.error('Unexpected error fetching route plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('receiving_route_plans')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('Error creating route plan:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating route plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
