import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth, withAdminAuth } from '@/lib/api/with-auth';
async function handleGet(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    
    let query = supabase
      .from('master_supplier')
      .select('*');

    // Apply search filter
    if (search) {
      const hasSpecialChars = /[|,()\\]/.test(search);
      if (!hasSpecialChars) {
        query = query.or(`supplier_id.ilike.%${search}%,supplier_code.ilike.%${search}%,supplier_name.ilike.%${search}%,contact_person.ilike.%${search}%`);
      }
    }

    // Apply type filter
    if (type && type !== 'ทั้งหมด') {
      query = query.eq('supplier_type', type);
    }

    // Apply status filter
    if (status && status !== 'ทั้งหมด') {
      query = query.eq('status', status);
    }

    // Apply category filter (product or service)
    if (category && category !== 'ทั้งหมด') {
      if (category === 'product') {
        query = query.not('product_category', 'is', null);
      } else if (category === 'service') {
        query = query.not('service_category', 'is', null);
      }
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: suppliers, error } = await query;

    if (error) {
      console.error('Error fetching suppliers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch suppliers' },
        { status: 500 }
      );
    }

    return NextResponse.json(suppliers);
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
    const supabase = await createClient();
    const body = await request.json();

    const {
      supplier_id,
      supplier_code,
      supplier_name,
      supplier_type = 'vendor',
      business_reg_no,
      tax_id,
      contact_person,
      phone,
      email,
      website,
      billing_address,
      shipping_address,
      payment_terms,
      service_category,
      product_category,
      rating = 0,
      status = 'active',
      created_by,
      remarks
    } = body;

    // Validate required fields
    if (!supplier_id || !supplier_code || !supplier_name || !created_by) {
      return NextResponse.json(
        { error: 'Missing required fields: supplier_id, supplier_code, supplier_name, created_by' },
        { status: 400 }
      );
    }

    const { data: supplier, error } = await supabase
      .from('master_supplier')
      .insert([{
        supplier_id,
        supplier_code,
        supplier_name,
        supplier_type,
        business_reg_no,
        tax_id,
        contact_person,
        phone,
        email,
        website,
        billing_address,
        shipping_address,
        payment_terms,
        service_category,
        product_category,
        rating,
        status,
        created_by,
        remarks
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier:', error);
      return NextResponse.json(
        { error: 'Failed to create supplier' },
        { status: 500 }
      );
    }

    return NextResponse.json(supplier, { status: 201 });
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
    const supabase = await createClient();
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const supplier_id = searchParams.get('id');

    if (!supplier_id) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      );
    }

    const {
      supplier_code,
      supplier_name,
      supplier_type,
      business_reg_no,
      tax_id,
      contact_person,
      phone,
      email,
      website,
      billing_address,
      shipping_address,
      payment_terms,
      service_category,
      product_category,
      rating,
      status,
      remarks
    } = body;

    const { data: supplier, error } = await supabase
      .from('master_supplier')
      .update({
        supplier_code,
        supplier_name,
        supplier_type,
        business_reg_no,
        tax_id,
        contact_person,
        phone,
        email,
        website,
        billing_address,
        shipping_address,
        payment_terms,
        service_category,
        product_category,
        rating,
        status,
        remarks,
        updated_at: new Date().toISOString()
      })
      .eq('supplier_id', supplier_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating supplier:', error);
      return NextResponse.json(
        { error: 'Failed to update supplier' },
        { status: 500 }
      );
    }

    return NextResponse.json(supplier);
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
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const supplier_id = searchParams.get('id');

    if (!supplier_id) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('master_supplier')
      .delete()
      .eq('supplier_id', supplier_id);

    if (error) {
      console.error('Error deleting supplier:', error);
      return NextResponse.json(
        { error: 'Failed to delete supplier' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Supplier deleted successfully' });
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
