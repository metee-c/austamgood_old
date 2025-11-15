import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { UserManagementService } from '@/lib/database/user-management';
import { CreateUserSchema, UserFiltersSchema } from '@/types/user-management-schema';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const userService = new UserManagementService(supabase);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Parse filters
  const filters = {
    search: searchParams.get('search') || undefined,
    role_id: searchParams.get('role_id') ? parseInt(searchParams.get('role_id')!) : undefined,
    is_active: searchParams.get('is_active') ? searchParams.get('is_active') === 'true' : undefined,
    employee_id: searchParams.get('employee_id') ? parseInt(searchParams.get('employee_id')!) : undefined,
  };

  const { data, error } = await userService.getAllUsers(filters, limit, offset);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const userService = new UserManagementService(supabase);

  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = CreateUserSchema.parse(body);

    const { data, error } = await userService.createUser(validatedData);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
  }
}
