import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route-handler';
import { withAuth, withAdminAuth } from '@/lib/api/with-auth';
async function handleGet(request: NextRequest, context: any) {
  try {
    const supabase = await createRouteClient();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    
    let query = supabase
      .from('master_warehouse')
      .select('*');

    // Apply search filter
    if (search) {
      const hasSpecialChars = /[|,()\\]/.test(search);
      if (!hasSpecialChars) {
        query = query.or(`warehouse_id.ilike.%${search}%,warehouse_name.ilike.%${search}%,contact_person.ilike.%${search}%`);
      }
    }

    // Apply type filter
    if (type && type !== 'ทั้งหมด') {
      query = query.eq('warehouse_type', type);
    }

    // Apply status filter
    if (status && status !== 'ทั้งหมด') {
      query = query.eq('active_status', status);
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: warehouses, error } = await query;

    if (error) {
      console.error('Error fetching warehouses:', error);
      return NextResponse.json(
        { error: 'Failed to fetch warehouses' },
        { status: 500 }
      );
    }

    return NextResponse.json(warehouses);
  } catch (error) {
    console.error('Unexpected error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePost(request: NextRequest, context: any) {
try {
    const supabase = await createRouteClient();
    const body = await request.json();

    const {
      warehouse_id,
      warehouse_name,
      warehouse_type = 'central',
      address,
      contact_person,
      phone,
      email,
      capacity_qty = 0,
      capacity_weight_kg = 0,
      active_status = 'active',
      created_by,
      remarks
    } = body;

    // Validate required fields
    if (!warehouse_id || !warehouse_name || !created_by) {
      return NextResponse.json(
        { error: 'Missing required fields: warehouse_id, warehouse_name, created_by' },
        { status: 400 }
      );
    }

    const { data: warehouse, error } = await supabase
      .from('master_warehouse')
      .insert([{
        warehouse_id,
        warehouse_name,
        warehouse_type,
        address,
        contact_person,
        phone,
        email,
        capacity_qty,
        capacity_weight_kg,
        active_status,
        created_by,
        remarks
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating warehouse:', error);
      return NextResponse.json(
        { error: 'Failed to create warehouse' },
        { status: 500 }
      );
    }

    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePut(request: NextRequest, context: any) {
  try {
    const supabase = await createRouteClient();
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const warehouse_id = searchParams.get('id');

    if (!warehouse_id) {
      return NextResponse.json(
        { error: 'Warehouse ID is required' },
        { status: 400 }
      );
    }

    const {
      warehouse_name,
      warehouse_type,
      address,
      contact_person,
      phone,
      email,
      capacity_qty,
      capacity_weight_kg,
      active_status,
      remarks
    } = body;

    const { data: warehouse, error } = await supabase
      .from('master_warehouse')
      .update({
        warehouse_name,
        warehouse_type,
        address,
        contact_person,
        phone,
        email,
        capacity_qty,
        capacity_weight_kg,
        active_status,
        remarks,
        updated_at: new Date().toISOString()
      })
      .eq('warehouse_id', warehouse_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating warehouse:', error);
      return NextResponse.json(
        { error: 'Failed to update warehouse' },
        { status: 500 }
      );
    }

    return NextResponse.json(warehouse);
  } catch (error) {
    console.error('Unexpected error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleDelete(request: NextRequest, context: any) {
  try {
    const supabase = await createRouteClient();
    const { searchParams } = new URL(request.url);
    const warehouse_id = searchParams.get('id');

    if (!warehouse_id) {
      return NextResponse.json(
        { error: 'Warehouse ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('master_warehouse')
      .delete()
      .eq('warehouse_id', warehouse_id);

    if (error) {
      console.error('Error deleting warehouse:', error);
      return NextResponse.json(
        { error: 'Failed to delete warehouse' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    console.error('Unexpected error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export with auth wrappers
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PUT = withAuth(handlePut);
export const DELETE = withAdminAuth(handleDelete);
