// ============================================================================
// API Route: Get Stock Import Batches
// GET /api/stock-import/batches
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stockImportService } from '@/lib/database/stock-import';
import type { StockImportBatchStatus } from '@/types/stock-import';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // รับ query parameters
    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouse_id') || undefined;
    const status = searchParams.get('status') as StockImportBatchStatus | undefined;
    const limit = parseInt(searchParams.get('limit') || '50');

    // ดึงรายการ batches
    const batches = await stockImportService.getImportBatches(warehouseId, status, limit);

    return NextResponse.json({
      success: true,
      batches,
      total: batches.length,
    });
  } catch (error: any) {
    console.error('Fetch batches error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: ลบ Import Batch
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // รับ batch_id
    const searchParams = request.nextUrl.searchParams;
    const batchId = searchParams.get('batch_id');

    if (!batchId) {
      return NextResponse.json({ error: 'ไม่ระบุ batch_id' }, { status: 400 });
    }

    // ลบ batch
    await stockImportService.deleteBatch(batchId);

    return NextResponse.json({
      success: true,
      message: 'ลบ Import Batch สำเร็จ',
    });
  } catch (error: any) {
    console.error('Delete batch error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการลบ' },
      { status: 500 }
    );
  }
}
