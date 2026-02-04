// ============================================================================
// API Route: Get Single Stock Import Batch
// GET /api/stock-import/batches/[id]
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stockImportService } from '@/lib/database/stock-import';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const resolvedParams = await params;
    const batchId = resolvedParams.id;

    // ดึงข้อมูล batch พร้อม staging
    const { batch, staging } = await stockImportService.getBatchWithStaging(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'ไม่พบ Import Batch' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      batch,
      staging,
      total_staging_records: staging.length,
    });
  } catch (error: any) {
    console.error('Fetch batch error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
