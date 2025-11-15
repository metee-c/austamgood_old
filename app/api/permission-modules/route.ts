import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { UserManagementService } from '@/lib/database/user-management';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const userService = new UserManagementService(supabase);

  const { data, error } = await userService.getAllPermissionModules();

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json(data);
}
