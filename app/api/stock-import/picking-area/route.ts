// ============================================================================
// API Route: Picking Area Stock Import
// Path: /api/stock-import/picking-area
// Description: นำเข้าสต็อกสำหรับพื้นที่หยิบ (Picking Area) ที่มีหลาย SKU ในโลเคชั่นเดียว
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { PickingAreaImportRowData } from '@/types/stock-import';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/stock-import/picking-area
 * อัพโหลดและนำเข้าข้อมูลสต็อกสำหรับ Picking Area
 */
export async function POST(request: Request) {
  try {
    // 1. Get user_id from request (passed from client)
    const formData = await request.formData();
    const userId = formData.get('user_id') as string;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 2. Parse remaining form data
    const file = formData.get('file') as File;
    const warehouseId = formData.get('warehouse_id') as string;
    const locationId = formData.get('location_id') as string;
    const batchName = formData.get('batch_name') as string | null;

    // 3. Validate inputs
    if (!file || !warehouseId || !locationId) {
      return NextResponse.json(
        { error: 'กรุณาระบุไฟล์, คลังสินค้า และโลเคชั่น' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'รองรับเฉพาะไฟล์ CSV เท่านั้น' },
        { status: 400 }
      );
    }

    // 4. Read and parse CSV file
    const fileContent = await file.text();
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'ไฟล์ CSV ต้องมีอย่างน้อย 2 แถว (header + data)' },
        { status: 400 }
      );
    }

    // Parse header
    const header = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split by comma, ignoring commas inside quotes
    const cleanHeader = header.map(h => h.trim().replace(/^"|"$/g, ''));

    // Parse data rows
    const dataRows: PickingAreaImportRowData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, ''));

      const row: any = {};
      cleanHeader.forEach((key, index) => {
        row[key] = cleanValues[index] || '';
      });

      dataRows.push(row);
    }

    console.log(`Parsed ${dataRows.length} rows from CSV`);

    // 5. Verify warehouse and location exist
    const { data: warehouseData, error: warehouseError } = await supabase
      .from('master_warehouse')
      .select('warehouse_id')
      .eq('warehouse_id', warehouseId)
      .single();

    if (warehouseError || !warehouseData) {
      return NextResponse.json(
        { error: `ไม่พบคลังสินค้า: ${warehouseId}` },
        { status: 400 }
      );
    }

    const { data: locationData, error: locationError } = await supabase
      .from('master_location')
      .select('location_id, location_code')
      .eq('location_id', locationId)
      .eq('warehouse_id', warehouseId)
      .single();

    if (locationError || !locationData) {
      return NextResponse.json(
        { error: `ไม่พบโลเคชั่น: ${locationId} ในคลัง ${warehouseId}` },
        { status: 400 }
      );
    }

    // 6. Generate batch ID
    const { data: batchId, error: batchIdError } = await supabase
      .rpc('generate_stock_import_batch_id');

    if (batchIdError || !batchId) {
      console.error('Error generating batch ID:', batchIdError);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้าง Batch ID ได้' },
        { status: 500 }
      );
    }

    // 7. Create import batch record with metadata
    const { error: batchInsertError } = await supabase
      .from('wms_stock_import_batches')
      .insert({
        batch_id: batchId,
        batch_name: batchName || `นำเข้า Picking Area ${locationData.location_code} - ${new Date().toLocaleDateString('th-TH')}`,
        warehouse_id: warehouseId,
        file_name: file.name,
        file_size: file.size,
        file_type: 'csv',
        total_rows: dataRows.length,
        status: 'uploading',
        created_by: parseInt(userId),
        started_at: new Date().toISOString(),
        validation_summary: {
          import_type: 'picking_area',
          location_id: locationId,
          location_code: locationData.location_code
        } as any,
      });

    if (batchInsertError) {
      console.error('Error creating batch:', batchInsertError);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้าง Import Batch ได้' },
        { status: 500 }
      );
    }

    // 8. Transform and insert staging data
    const stagingRecords = dataRows.map((row, index) => {
      const weightStr = row['จำนวนน้ำหนัก (ปกติ)'] || row['weight'] || '0';
      const quantityStr = row['จำนวนถุง (ปกติ)'] || row['quantity'] || '0';

      return {
        import_batch_id: batchId,
        row_number: index + 2, // +2 because row 1 is header
        warehouse_id: warehouseId,
        location_id: locationData.location_code, // Use location_code as location_id in staging

        // SKU data
        sku_id: row['SKU'] || row['sku'] || null,
        product_name: row['Product_Name'] || row['product_name'] || null,
        barcode: row['Barcode'] || row['barcode'] || null,

        // Quantity data (stored in piece_qty for picking area)
        piece_qty: parseFloat(quantityStr.replace(/,/g, '')) || 0,
        pack_qty: 0, // Picking area uses piece_qty only
        weight_kg: parseFloat(weightStr.replace(/,/g, '')) || 0,

        // Additional info
        stock_status: row['Type'] || row['type'] || 'ปกติ',
        remarks: [
          row['Remark'] || row['remark'],
          row['Unit'] || row['unit'] ? `หน่วย: ${row['Unit'] || row['unit']}` : null
        ]
          .filter(Boolean)
          .join(' | ') || null,

        processing_status: 'pending',
        created_by: parseInt(userId),
      };
    });

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < stagingRecords.length; i += batchSize) {
      const batch = stagingRecords.slice(i, i + batchSize);
      const { error: stagingError } = await supabase
        .from('wms_stock_import_staging')
        .insert(batch);

      if (stagingError) {
        console.error(`Error inserting staging batch ${i / batchSize + 1}:`, stagingError);
        // Mark batch as failed
        await supabase
          .from('wms_stock_import_batches')
          .update({ status: 'failed' })
          .eq('batch_id', batchId);

        return NextResponse.json(
          { error: `ไม่สามารถบันทึกข้อมูล staging ได้ (แถวที่ ${i + 1}-${i + batch.length})` },
          { status: 500 }
        );
      }
    }

    // 9. Update batch status to validating
    await supabase
      .from('wms_stock_import_batches')
      .update({ status: 'validating' })
      .eq('batch_id', batchId);

    // 10. Return success
    return NextResponse.json({
      success: true,
      batch_id: batchId,
      total_rows: dataRows.length,
      message: `อัพโหลดสำเร็จ ${dataRows.length} แถว ไปยัง ${locationData.location_code}`,
    });

  } catch (error: any) {
    console.error('Picking area import error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการอัพโหลด' },
      { status: 500 }
    );
  }
}
