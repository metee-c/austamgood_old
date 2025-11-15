
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { customerSchema } from '@/types/customer-schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const supabase = await createClient();
  
  let query = supabase.from('master_customer').select('*');

  if (search) {
    query = query.or(`customer_code.ilike.%${search}%,customer_name.ilike.%${search}%`);
  }

  const { data: customers, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(customers);
}

export async function POST(request: Request) {
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

export async function PUT(request: Request) {
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

export async function DELETE(request: Request) {
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
