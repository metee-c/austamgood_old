// ============================================================================
// API Route: Get Stock Import Progress (Real-time)
// GET /api/stock-import/batches/[id]/progress
// ใช้ SQL COUNT เพื่อหลีกเลี่ยง 1000 row limit
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    // ใช้ raw SQL เพื่อนับจำนวนตามสถานะ (ไม่โดน 1000 row limit)
    const { data: statusCounts, error } = await supabase
      .from('wms_stock_import_staging')
      .select('processing_status', { count: 'exact', head: false })
      .eq('import_batch_id', batchId);

    // ถ้า select ไม่ได้ count ให้ใช้ raw query แทน
    const { data: countData, error: countError } = await supabase.rpc(
      'exec_sql',
      {
        query: `
          SELECT processing_status, COUNT(*)::int as count
          FROM wms_stock_import_staging
          WHERE import_batch_id = '${batchId}'
          GROUP BY processing_status
        `,
      }
    );

    // ถ้าไม่มี exec_sql function ให้นับแยกทีละสถานะ
    if (countError) {
      // นับแต่ละสถานะแยกกัน (ใช้ count: 'exact')
      const statuses = ['pending', 'validated', 'processed', 'error', 'skipped'];
      const counts: Record<string, number> = {
        pending: 0,
        validated: 0,
        processed: 0,
        error: 0,
        skipped: 0,
        total: 0,
      };

      await Promise.all(
        statuses.map(async (status) => {
          const { count } = await supabase
            .from('wms_stock_import_staging')
            .select('*', { count: 'exact', head: true })
            .eq('import_batch_id', batchId)
            .eq('processing_status', status);
          counts[status] = count || 0;
          counts.total += count || 0;
        })
      );

      const validatedCount = counts.validated + counts.error;
      const processedCount = counts.processed + counts.skipped;

      return NextResponse.json({
        success: true,
        counts,
        validated_count: validatedCount,
        processed_count: processedCount,
        total: counts.total,
      });
    }

    // ใช้ผลจาก raw query
    const counts: Record<string, number> = {
      pending: 0,
      validated: 0,
      processed: 0,
      error: 0,
      skipped: 0,
      total: 0,
    };

    countData?.forEach((row: { processing_status: string; count: number }) => {
      const status = row.processing_status;
      if (status in counts) {
        counts[status] = row.count;
      }
      counts.total += row.count;
    });

    const validatedCount = counts.validated + counts.error;
    const processedCount = counts.processed + counts.skipped;

    return NextResponse.json({
      success: true,
      counts,
      validated_count: validatedCount,
      processed_count: processedCount,
      total: counts.total,
    });
  } catch (error: any) {
    console.error('Fetch progress error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
