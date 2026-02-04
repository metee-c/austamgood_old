
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
export async function POST(request: Request) {
const supabase = await createClient();
  const customers = await request.json();

  // TODO: Add validation for the customer data

  const { data, error } = await supabase
    .from('master_customer')
    .insert(customers)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
