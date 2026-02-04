import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { parse } from 'csv-parse/sync';
export const dynamic = 'force-dynamic';

const REQUIRED_FIELDS = ['area_code', 'area_name', 'warehouse_id', 'zone', 'area_type', 'status'];
const VALID_AREA_TYPES = ['packing', 'quality_check', 'consolidation', 'labeling', 'other'];
const VALID_STATUSES = ['active', 'inactive', 'maintenance'];

interface PreparationAreaData {
  area_code: string;
  area_name: string;
  description?: string;
  warehouse_id: string;
  zone: string;
  area_type: string;
  capacity_sqm?: number;
  current_utilization_pct?: number;
  max_capacity_pallets?: number;
  current_pallets?: number;
  status: string;
  created_by?: string;
  updated_by?: string;
}

function validateRow(row: any, lineNumber: number): { isValid: boolean; data?: PreparationAreaData; errors: string[] } {
  const errors: string[] = [];
  const data: PreparationAreaData = {} as PreparationAreaData;

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || row[field].trim() === '') {
      errors.push(`ขาดข้อมูลบังคับ: ${field}`);
    }
  }

  // Skip validation if missing required fields
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Map and validate data
  data.area_code = row.area_code.trim();
  data.area_name = row.area_name.trim();
  data.warehouse_id = row.warehouse_id.trim();
  data.zone = row.zone.trim();
  data.area_type = row.area_type.trim().toLowerCase();
  data.status = row.status.trim().toLowerCase();

  // Validate area_type
  if (!VALID_AREA_TYPES.includes(data.area_type)) {
    errors.push(`area_type ไม่ถูกต้อง: ${data.area_type} (ต้องเป็น: ${VALID_AREA_TYPES.join(', ')})`);
  }

  // Validate status
  if (!VALID_STATUSES.includes(data.status)) {
    errors.push(`status ไม่ถูกต้อง: ${data.status} (ต้องเป็น: ${VALID_STATUSES.join(', ')})`);
  }

  // Validate numeric fields
  if (row.capacity_sqm && row.capacity_sqm.trim() !== '') {
    const capacity = parseFloat(row.capacity_sqm);
    if (isNaN(capacity) || capacity < 0) {
      errors.push('capacity_sqm ต้องเป็นตัวเลข >= 0');
    } else {
      data.capacity_sqm = capacity;
    }
  }

  if (row.current_utilization_pct && row.current_utilization_pct.trim() !== '') {
    const utilization = parseFloat(row.current_utilization_pct);
    if (isNaN(utilization) || utilization < 0 || utilization > 100) {
      errors.push('current_utilization_pct ต้องเป็นตัวเลขระหว่าง 0-100');
    } else {
      data.current_utilization_pct = utilization;
    }
  }

  if (row.max_capacity_pallets && row.max_capacity_pallets.trim() !== '') {
    const maxPallets = parseInt(row.max_capacity_pallets);
    if (isNaN(maxPallets) || maxPallets < 0) {
      errors.push('max_capacity_pallets ต้องเป็นตัวเลขจำนวนเต็ม >= 0');
    } else {
      data.max_capacity_pallets = maxPallets;
    }
  }

  if (row.current_pallets && row.current_pallets.trim() !== '') {
    const currentPallets = parseInt(row.current_pallets);
    if (isNaN(currentPallets) || currentPallets < 0) {
      errors.push('current_pallets ต้องเป็นตัวเลขจำนวนเต็ม >= 0');
    } else {
      data.current_pallets = currentPallets;
    }
  }

  // Optional fields
  if (row.description && row.description.trim() !== '') {
    data.description = row.description.trim();
  }

  if (row.created_by && row.created_by.trim() !== '') {
    data.created_by = row.created_by.trim();
  }

  if (row.updated_by && row.updated_by.trim() !== '') {
    data.updated_by = row.updated_by.trim();
  }

  return {
    isValid: errors.length === 0,
    data,
    errors
  };
}

export async function POST(request: NextRequest) {
try {
    const supabase = createServiceRoleClient();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'กรุณาเลือกไฟล์ CSV' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'ไฟล์ต้องเป็น CSV เท่านั้น' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      encoding: 'utf8',
      bom: true
    });

    if (records.length === 0) {
      return NextResponse.json(
        { error: 'ไฟล์ CSV ไม่มีข้อมูล' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      errors: 0,
      details: [] as Array<{
        line: number;
        area_code: string;
        success: boolean;
        message: string;
        errors?: string[];
      }>
    };

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i] as any;
      const lineNumber = i + 2; // +2 for header and 1-based index

      const validation = validateRow(record, lineNumber);

      if (!validation.isValid || !validation.data) {
        results.errors++;
        results.details.push({
          line: lineNumber,
          area_code: record.area_code || 'N/A',
          success: false,
          message: 'ข้อมูลไม่ถูกต้อง',
          errors: validation.errors
        });
        continue;
      }

      const data = validation.data;

      try {
        // Check for duplicate area_code in the same warehouse
        const { data: existingArea } = await supabase
          .from('preparation_area')
          .select('area_id')
          .eq('warehouse_id', data.warehouse_id)
          .eq('area_code', data.area_code)
          .single();

        if (existingArea) {
          results.errors++;
          results.details.push({
            line: lineNumber,
            area_code: data.area_code,
            success: false,
            message: 'รหัสพื้นที่ซ้ำในคลังสินค้านี้'
          });
          continue;
        }

        // Insert preparation area
        const { error } = await supabase
          .from('preparation_area')
          .insert([{
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (error) {
          throw error;
        }

        results.success++;
        results.details.push({
          line: lineNumber,
          area_code: data.area_code,
          success: true,
          message: 'นำเข้าข้อมูลสำเร็จ'
        });
      } catch (error: any) {
        console.error(`Error importing preparation area at line ${lineNumber}:`, error);
        results.errors++;
        results.details.push({
          line: lineNumber,
          area_code: data.area_code,
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล'
        });
      }
    }

    return NextResponse.json({
      message: 'นำเข้าข้อมูลเสร็จสิ้น',
      summary: {
        total: records.length,
        success: results.success,
        errors: results.errors
      },
      details: results.details
    });
  } catch (error) {
    console.error('Error importing preparation areas:', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล' },
      { status: 500 }
    );
  }
}
