import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { EmployeeSchema } from '@/types/employee-schema';
import { withAuth, withAdminAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function handleGet(request: NextRequest, context: any) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const supabase = await createClient();
  
  let query = supabase.from('master_employee').select('*');

  if (search) {
    const hasSpecialChars = /[|,()\\]/.test(search);
    if (!hasSpecialChars) {
      query = query.or(`employee_code.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }
  }

  const { data: employees, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(employees || []);
}

async function handlePost(request: NextRequest, context: any) {
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

async function handlePut(request: NextRequest, context: any) {
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

async function handleDelete(request: NextRequest, context: any) {
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

// Export with auth wrappers
export const GET = withShadowLog(withAuth(handleGet));
export const POST = withShadowLog(withAuth(handlePost));
export const PUT = withShadowLog(withAuth(handlePut));
export const DELETE = withShadowLog(withAdminAuth(handleDelete));
