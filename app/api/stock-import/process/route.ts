// ============================================================================
// API Route: Process Stock Import (นำเข้าจริง)
// POST /api/stock-import/process
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stockImportService } from '@/lib/database/stock-import';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { withAuth } from '@/lib/api/with-auth';
export const dynamic = 'force-dynamic';

async function handlePost(request: NextRequest, context: any) {
try {
    const supabase = await createClient();

    // รับข้อมูล
    const body = await request.json();
    const { batch_id, skip_errors = true } = body;

    if (!batch_id) {
      return NextResponse.json({ error: 'ไม่ระบุ batch_id' }, { status: 400 });
    }

    // ตรวจสอบว่า batch มีอยู่จริง
    const { batch } = await stockImportService.getBatchWithStaging(batch_id);

    if (!batch) {
      return NextResponse.json({ error: 'ไม่พบ Import Batch' }, { status: 404 });
    }

    // ตรวจสอบสถานะ
    if (batch.status !== 'validated') {
      return NextResponse.json(
        { error: 'ต้องตรวจสอบข้อมูลก่อนนำเข้า' },
        { status: 400 }
      );
    }

    // Get user ID from authenticated session
    const userId = context.user.user_id;

    // Set user context for audit trail
    await setDatabaseUserContext(supabase, userId);

    // ประมวลผลการนำเข้า
    const processingSummary = await stockImportService.processImport(
      batch_id,
      userId,
      skip_errors
    );

    return NextResponse.json({
      success: true,
      batch_id,
      status: 'completed',
      processing_summary: processingSummary,
      message: `นำเข้าสำเร็จ ${processingSummary.success_count} รายการ`,
    });
  } catch (error: any) {
    console.error('Processing error:', error);

    // อัพเดทสถานะเป็น failed
    try {
      const body = await request.json();
      await stockImportService.updateBatchStatus(body.batch_id, 'failed');
    } catch (e) {
      // Ignore
    }

    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการนำเข้า' },
      { status: 500 }
    );
  }
}

// Export with auth wrapper
export const POST = withAuth(handlePost);
