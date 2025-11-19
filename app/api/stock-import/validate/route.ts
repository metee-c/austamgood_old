// ============================================================================
// API Route: Validate Stock Import Data
// POST /api/stock-import/validate
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
    const { batch_id } = body;

    if (!batch_id) {
      return NextResponse.json({ error: 'ไม่ระบุ batch_id' }, { status: 400 });
    }

    // ตรวจสอบว่า batch มีอยู่จริง
    const { batch, staging } = await stockImportService.getBatchWithStaging(batch_id);

    if (!batch) {
      return NextResponse.json({ error: 'ไม่พบ Import Batch' }, { status: 404 });
    }

    // Validate ข้อมูล
    const validationSummary = await stockImportService.validateStagingData(batch_id);

    // ดึง staging records ที่มี error
    const { data: errorRecords } = await supabase
      .from('wms_stock_import_staging')
      .select('row_number, location_id, sku_id, validation_errors, validation_warnings')
      .eq('import_batch_id', batch_id)
      .eq('processing_status', 'error')
      .order('row_number', { ascending: true })
      .limit(100);

    const errors = (errorRecords || []).flatMap((record: any) =>
      (record.validation_errors || []).map((error: string) => ({
        row_number: record.row_number,
        field: 'various',
        error_type: 'validation_error',
        message: error,
        severity: 'error' as const,
      }))
    );

    const { data: warningRecords } = await supabase
      .from('wms_stock_import_staging')
      .select('row_number, location_id, sku_id, validation_warnings')
      .eq('import_batch_id', batch_id)
      .not('validation_warnings', 'is', null)
      .order('row_number', { ascending: true })
      .limit(100);

    const warnings = (warningRecords || []).flatMap((record: any) =>
      (record.validation_warnings || []).map((warning: string) => ({
        row_number: record.row_number,
        field: 'various',
        error_type: 'validation_warning',
        message: warning,
        severity: 'warning' as const,
      }))
    );

    return NextResponse.json({
      success: true,
      batch_id,
      status: batch.status,
      validation_summary: validationSummary,
      errors,
      warnings,
    });
  } catch (error: any) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการตรวจสอบ' },
      { status: 500 }
    );
  }
}
