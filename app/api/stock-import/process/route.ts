// ============================================================================
// API Route: Process Stock Import (นำเข้าจริง)
// POST /api/stock-import/process
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stockImportService } from '@/lib/database/stock-import';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ตรวจสอบ authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // ประมวลผลการนำเข้า
    const processingSummary = await stockImportService.processImport(
      batch_id,
      parseInt(user.id),
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
