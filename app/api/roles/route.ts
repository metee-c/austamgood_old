import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { UserManagementService } from '@/lib/database/user-management';
import { CreateRoleSchema } from '@/types/user-management-schema';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const userService = new UserManagementService(supabase);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Parse filters
  const filters = {
    search: searchParams.get('search') || undefined,
    is_active: searchParams.get('is_active') ? searchParams.get('is_active') === 'true' : undefined,
  };

  const { data, error } = await userService.getAllRoles(filters, limit, offset);

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
    const validatedData = CreateRoleSchema.parse(body);

    const { data, error } = await userService.createRole(validatedData);

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
