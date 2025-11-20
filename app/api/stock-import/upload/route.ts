// ============================================================================
// API Route: Upload Stock Import File
// POST /api/stock-import/upload
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stockImportService } from '@/lib/database/stock-import';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // รับข้อมูลจาก FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const warehouseId = formData.get('warehouse_id') as string;
    const batchName = formData.get('batch_name') as string | null;

    // Validate input
    if (!file) {
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 });
    }

    if (!warehouseId) {
      return NextResponse.json({ error: 'ไม่ระบุคลังสินค้า' }, { status: 400 });
    }

    // ตรวจสอบประเภทไฟล์
    const fileType = file.name.toLowerCase().endsWith('.csv') ? 'csv' :
                     file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') ? 'excel' :
                     null;

    if (!fileType) {
      return NextResponse.json(
        { error: 'รองรับเฉพาะไฟล์ CSV หรือ Excel เท่านั้น' },
        { status: 400 }
      );
    }

    // อ่านไฟล์
    const fileBuffer = await file.arrayBuffer();
    const fileText = new TextDecoder().decode(fileBuffer);

    // Parse CSV
    let rows: any[] = [];
    if (fileType === 'csv') {
      rows = parseCSV(fileText);
    } else {
      // สำหรับ Excel ต้องใช้ library เช่น xlsx
      return NextResponse.json(
        { error: 'ยังไม่รองรับไฟล์ Excel ในขณะนี้ กรุณาใช้ CSV' },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'ไฟล์ว่างเปล่า' }, { status: 400 });
    }

    // Use a default user ID (1) since there's no authentication
    const userId = 1;

    // สร้าง Import Batch
    const batch = await stockImportService.createImportBatch(
      warehouseId,
      file.name,
      file.size,
      fileType,
      rows.length,
      userId,
      batchName || undefined
    );

    // บันทึกข้อมูลลง Staging
    await stockImportService.insertStagingData(
      batch.batch_id,
      rows,
      warehouseId,
      userId
    );

    // อัพเดทสถานะเป็น validating
    await stockImportService.updateBatchStatus(batch.batch_id, 'validating');

    return NextResponse.json({
      success: true,
      batch_id: batch.batch_id,
      total_rows: rows.length,
      message: 'อัพโหลดไฟล์สำเร็จ',
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการอัพโหลด' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Parse CSV
// ============================================================================

function parseCSV(text: string): any[] {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // แยก header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  // แยกแถวข้อมูล
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values.map(v => v.replace(/^"|"$/g, ''));
}
