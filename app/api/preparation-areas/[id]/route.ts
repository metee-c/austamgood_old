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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: preparationArea, error } = await supabase
      .from('preparation_area')
      .select(PREPARATION_AREA_FIELDS)
      .eq('area_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Preparation area not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(preparationArea);
  } catch (error) {
    console.error('Error fetching preparation area:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preparation area' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check for duplicate area_code in the same warehouse (excluding current record)
    const { data: existingArea } = await supabase
      .from('preparation_area')
      .select('area_id')
      .eq('warehouse_id', body.warehouse_id)
      .eq('area_code', body.area_code)
      .neq('area_id', id)
      .single();

    if (existingArea) {
      return NextResponse.json(
        { error: 'Area code already exists in this warehouse' },
        { status: 409 }
      );
    }

    const { data: updatedArea, error } = await supabase
      .from('preparation_area')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('area_id', id)
      .select(PREPARATION_AREA_FIELDS)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Preparation area not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(updatedArea);
  } catch (error) {
    console.error('Error updating preparation area:', error);
    return NextResponse.json(
      { error: 'Failed to update preparation area' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await supabase
      .from('preparation_area')
      .delete()
      .eq('area_id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Preparation area not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ message: 'Preparation area deleted successfully' });
  } catch (error) {
    console.error('Error deleting preparation area:', error);
    return NextResponse.json(
      { error: 'Failed to delete preparation area' },
      { status: 500 }
    );
  }
}
