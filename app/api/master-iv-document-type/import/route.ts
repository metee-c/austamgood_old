import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 400 });
    }

    const csvText = await file.text();
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'ไฟล์ CSV ต้องมีข้อมูลอย่างน้อย 1 แถว' }, { status: 400 });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1);

    const requiredColumns = ['doc_type_code', 'doc_type_name', 'created_by'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return NextResponse.json({ 
        error: `ไฟล์ CSV ขาดคอลัมน์ที่จำเป็น: ${missingColumns.join(', ')}` 
      }, { status: 400 });
    }

    const importResults = {
      success: 0,
      errors: [] as Array<{ row: number; message: string }>
    };

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 because of header and 0-based index
      const values = rows[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length !== headers.length) {
        importResults.errors.push({
          row: rowNumber,
          message: 'จำนวนคอลัมน์ไม่ตรงกับ header'
        });
        continue;
      }

      try {
        const rowData: any = {};
        headers.forEach((header, index) => {
          let value = values[index];
          
          // Handle boolean fields
          if (header === 'return_required' || header === 'is_active') {
            rowData[header] = value.toLowerCase() === 'true';
          }
          // Handle numeric fields
          else if (header === 'retention_period_months') {
            rowData[header] = value ? parseInt(value) : null;
          }
          // Handle string fields
          else {
            rowData[header] = value || null;
          }
        });

        // Validate required fields
        if (!rowData.doc_type_code || !rowData.doc_type_name || !rowData.created_by) {
          importResults.errors.push({
            row: rowNumber,
            message: 'ข้อมูลที่จำเป็นไม่ครบถ้วน (doc_type_code, doc_type_name, created_by)'
          });
          continue;
        }

        // Check for duplicate doc_type_code
        const { data: existing } = await supabase
          .from('master_iv_document_type')
          .select('doc_type_id')
          .eq('doc_type_code', rowData.doc_type_code)
          .single();

        if (existing) {
          importResults.errors.push({
            row: rowNumber,
            message: `รหัสประเภทเอกสาร ${rowData.doc_type_code} มีอยู่แล้ว`
          });
          continue;
        }

        // Insert the record
        const { error: insertError } = await supabase
          .from('master_iv_document_type')
          .insert(rowData);

        if (insertError) {
          importResults.errors.push({
            row: rowNumber,
            message: insertError.message
          });
        } else {
          importResults.success++;
        }

      } catch (error) {
        importResults.errors.push({
          row: rowNumber,
          message: 'เกิดข้อผิดพลาดในการประมวลผลข้อมูล'
        });
      }
    }

    return NextResponse.json(importResults);

  } catch (error) {
    console.error('Error importing document types:', error);

    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล' }, { status: 500 });
  }
}

export const POST = withShadowLog(_POST);
