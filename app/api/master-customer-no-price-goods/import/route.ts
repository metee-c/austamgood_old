import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function POST(request: NextRequest) {
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

    const requiredColumns = ['customer_id', 'customer_name', 'created_by'];
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
          if (header === 'is_active') {
            rowData[header] = value.toLowerCase() === 'true';
          }
          // Handle date fields
          else if (header === 'effective_start_date' || header === 'effective_end_date') {
            rowData[header] = value || null;
          }
          // Handle string fields
          else {
            rowData[header] = value || null;
          }
        });

        // Validate required fields
        if (!rowData.customer_id || !rowData.customer_name || !rowData.created_by) {
          importResults.errors.push({
            row: rowNumber,
            message: 'ข้อมูลที่จำเป็นไม่ครบถ้วน (customer_id, customer_name, created_by)'
          });
          continue;
        }

        // Check for duplicate customer_id
        const { data: existing } = await supabase
          .from('master_customer_no_price_goods')
          .select('record_id')
          .eq('customer_id', rowData.customer_id)
          .single();

        if (existing) {
          importResults.errors.push({
            row: rowNumber,
            message: `รหัสลูกค้า ${rowData.customer_id} มีอยู่แล้ว`
          });
          continue;
        }

        // Insert the record
        const { error: insertError } = await supabase
          .from('master_customer_no_price_goods')
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
    console.error('Error importing customer no price goods:', error);

    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล' }, { status: 500 });
  }
}