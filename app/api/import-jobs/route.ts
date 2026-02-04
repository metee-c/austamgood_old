import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { FileManagementService } from '@/lib/database/file-management';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: Request) {
  const supabase = await createClient();
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

export const GET = withShadowLog(_GET);
