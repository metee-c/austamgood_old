import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { customerSchema } from '@/types/customer-schema';
import { withAuth, withAdminAuth } from '@/lib/api/with-auth';

async function handleGet(request: NextRequest, context: any) {
  const { searchParams } = new URL(request.url);
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว
  const search = searchParams.get('search');
  const supabase = await createClient();
  
  // Build query with count
  let query = supabase.from('master_customer').select('*');

  if (search) {
    const hasSpecialChars = /[|,()\\]/.test(search);
    if (!hasSpecialChars) {
      query = query.or(`customer_code.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }
  }

  // Apply pagination
  query = query;

  const { data: customers, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: customers
  });
}

async function handlePost(request: NextRequest, context: any) {
  const supabase = await createClient();
  const body = await request.json();

  const result = customerSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('master_customer')
    .insert([result.data])
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

async function handlePut(request: NextRequest, context: any) {
  const supabase = await createClient();
  const body = await request.json();

  const result = customerSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('master_customer')
    .update(result.data)
    .eq('customer_id', result.data.customer_id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

async function handleDelete(request: NextRequest, context: any) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const customer_id = searchParams.get('id');

  if (!customer_id) {
    return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('master_customer')
    .delete()
    .eq('customer_id', customer_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Customer deleted successfully' });
}

// Export with auth wrappers
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PUT = withAuth(handlePut);
export const DELETE = withAdminAuth(handleDelete);
