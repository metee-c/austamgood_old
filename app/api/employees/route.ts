import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');

  let query = supabase
    .from('master_employee')
    .select('employee_id, employee_name, employee_code, position, department')
    .eq('is_active', true)
    .order('employee_name', { ascending: true });

  // Apply search filter if provided
  if (search) {
    query = query.or(`employee_name.ilike.%${search}%,employee_code.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
