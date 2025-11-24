// ============================================================================
// API Route: Process Picking Area Import (นำเข้าจริง)
// POST /api/stock-import/picking-area/process
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stockImportService } from '@/lib/database/stock-import';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {

    // รับข้อมูล
    const body = await request.json();
    const { batch_id, location_id, skip_errors = true } = body;

    if (!batch_id || !location_id) {
      return NextResponse.json(
        { error: 'ไม่ระบุ batch_id หรือ location_id' },
        { status: 400 }
      );
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

    // Use default user ID (1) since there's no authentication
    const userId = 1;

    // ประมวลผลการนำเข้า Picking Area
    const processingSummary = await stockImportService.processPickingAreaImport(
      batch_id,
      location_id,
      userId,
      skip_errors
    );

    return NextResponse.json({
      success: true,
      batch_id,
      status: 'completed',
      processing_summary: processingSummary,
      message: `นำเข้าสำเร็จ ${processingSummary.success_count} รายการ ไปยังพื้นที่หยิบ`,
    });
  } catch (error: any) {
    console.error('Picking area processing error:', error);

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
