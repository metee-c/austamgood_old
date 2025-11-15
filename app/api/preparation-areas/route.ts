import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const PREPARATION_AREA_FIELDS = `
  area_id,
  area_code,
  area_name,
  description,
  warehouse_id,
  zone,
  area_type,
  capacity_sqm,
  current_utilization_pct,
  max_capacity_pallets,
  current_pallets,
  status,
  created_by,
  updated_by,
  created_at,
  updated_at,
  master_warehouse (
    warehouse_name
  )
`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const warehouse_id = searchParams.get('warehouse_id') || '';
    const zone = searchParams.get('zone') || '';
    const area_type = searchParams.get('area_type') || '';
    const status = searchParams.get('status') || '';
    const sort_by = searchParams.get('sort_by') || 'area_name';
    const sort_order = searchParams.get('sort_order') || 'asc';

    const offset = (page - 1) * limit;

    let query = supabase
      .from('preparation_area')
      .select(PREPARATION_AREA_FIELDS, { count: 'exact' });

    if (search) {
      query = query.or(`area_code.ilike.%${search}%,area_name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id);
    }

    if (zone) {
      query = query.eq('zone', zone);
    }

    if (area_type) {
      query = query.eq('area_type', area_type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: preparationAreas, error, count } = await query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      data: preparationAreas || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching preparation areas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preparation areas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['area_code', 'area_name', 'warehouse_id', 'zone', 'area_type'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for duplicate area_code in the same warehouse
    const { data: existingArea } = await supabase
      .from('preparation_area')
      .select('area_id')
      .eq('warehouse_id', body.warehouse_id)
      .eq('area_code', body.area_code)
      .single();

    if (existingArea) {
      return NextResponse.json(
        { error: 'Area code already exists in this warehouse' },
        { status: 409 }
      );
    }

    const { data: newArea, error } = await supabase
      .from('preparation_area')
      .insert([{
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select(PREPARATION_AREA_FIELDS)
      .single();

    if (error) throw error;

    return NextResponse.json(newArea, { status: 201 });
  } catch (error) {
    console.error('Error creating preparation area:', error);
    return NextResponse.json(
      { error: 'Failed to create preparation area' },
      { status: 500 }
    );
  }
}
