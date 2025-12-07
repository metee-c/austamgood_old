import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { EmployeeSchema } from '@/types/employee-schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const supabase = await createClient();
  
  let query = supabase.from('master_employee').select('*');

  if (search) {
    query = query.or(`employee_code.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  }

  const { data: employees, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(employees || []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  // Convert empty strings to null for optional fields
  Object.keys(body).forEach(key => {
    if (body[key] === '') {
      body[key] = null;
    }
  });

  const result = EmployeeSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('master_employee')
    .insert([result.data])
    .select();

  if (error) {
    console.error('Error inserting employee:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  // Convert empty strings to null for optional fields
  Object.keys(body).forEach(key => {
    if (body[key] === '') {
      body[key] = null;
    }
  });

  const result = EmployeeSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('master_employee')
    .update(result.data)
    .eq('employee_id', result.data.employee_id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const employee_id = searchParams.get('id');

  if (!employee_id) {
    return NextResponse.json({ error: 'Missing employee_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('master_employee')
    .delete()
    .eq('employee_id', employee_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Employee deleted successfully' });
}
