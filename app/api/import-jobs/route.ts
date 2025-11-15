import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { FileManagementService } from '@/lib/database/file-management';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const fileService = new FileManagementService(supabase);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  const { data, error } = await fileService.getAllImportJobs(limit, offset);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
