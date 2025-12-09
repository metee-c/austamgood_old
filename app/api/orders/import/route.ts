import { NextRequest, NextResponse } from 'next/server';
import { ordersService } from '@/lib/database/orders.service';
import * as XLSX from 'xlsx';

function parseCSV(text: string): string[][] {
  const lines = text.split('\n');
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    result.push(values);
  }

  return result;
}

// Function to parse various date formats
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Remove extra spaces and trim
  dateStr = dateStr.trim();
  
  // If already in ISO format, return as is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr;
  }
  
  // Handle format like "14 10 2025" (DD MM YYYY)
  if (dateStr.match(/^\d{1,2}\s+\d{1,2}\s+\d{4}$/)) {
    const parts = dateStr.split(/\s+/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  
  // Handle format like "14/10/2025" or "14-10-2025"
  if (dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  
  // Handle format like "2025/10/14" or "2025-10-14"
  if (dateStr.match(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/)) {
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as 'route_planning' | 'express' | 'special';
    const defaultWarehouseId = formData.get('defaultWarehouseId') as string | null;
    const deliveryDate = formData.get('deliveryDate') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!fileType || (fileType !== 'route_planning' && fileType !== 'express' && fileType !== 'special')) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    if ((fileType === 'express' || fileType === 'special') && !defaultWarehouseId) {
      return NextResponse.json(
        { error: 'Default warehouse ID is required for express and special file types' },
        { status: 400 }
      );
    }

    let rows: string[][];

    // ตรวจสอบประเภทไฟล์และอ่านข้อมูล
    if (file.name.toLowerCase().endsWith('.csv')) {
      // อ่านไฟล์ CSV
      const text = await file.text();
      rows = parseCSV(text);
    } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
      // อ่านไฟล์ Excel
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      rows = jsonData as string[][];
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please use .csv, .xlsx, or .xls files.' },
        { status: 400 }
      );
    }

    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'File is empty or has no data rows' },
        { status: 400 }
      );
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // ตรวจสอบโครงสร้างไฟล์ว่าตรงกับประเภทที่เลือกหรือไม่
    const validateFileStructure = () => {
      // ตรวจสอบว่ามีข้อมูลอย่างน้อย 2 แถวของข้อมูล
      if (dataRows.length < 2) {
        return {
          valid: false,
          message: 'ไฟล์มีข้อมูลน้อยเกินไป ต้องมีอย่างน้อย 2 แถวของข้อมูล'
        };
      }

      // แปลง headers เป็น string และ trim เพื่อเปรียบเทียบ
      const headerStr = headers.map((h: any) => String(h || '').trim()).join(',');
      
      // Debug: แสดงหัวคอลัมน์
      console.log('[FILE VALIDATION] Header columns:', headers.slice(0, 5));
      console.log('[FILE VALIDATION] Total columns:', headers.length);
      console.log('[FILE VALIDATION] Selected file type:', fileType);
      
      // ตรวจสอบว่าไฟล์เป็นประเภทใด โดยดูจากหัวคอลัมน์
      const hasDateColumn = headerStr.includes('วันที่');
      const hasWarehouseColumn = headerStr.includes('คลัง');
      const hasDateSequenceColumn = headerStr.includes('วันที่-ลำดับ');
      const hasPhoneColumn = headerStr.includes('โทรศัพท์');
      const hasAddressColumn = headerStr.includes('ที่อยู่จัดส่ง');
      const startsWithOrderNo = headers[0] && String(headers[0]).trim().includes('เลขที่');

      console.log('[FILE VALIDATION] Detection flags:', {
        hasDateColumn,
        hasWarehouseColumn,
        hasDateSequenceColumn,
        hasPhoneColumn,
        hasAddressColumn,
        startsWithOrderNo
      });

      // ตรวจสอบว่าจำนวนคอลัมน์ตรงกับประเภทที่เลือกหรือไม่
      console.log('[FILE VALIDATION] User selected file type:', fileType);
      console.log('[FILE VALIDATION] File has', headers.length, 'columns');
      
      // Route Planning: 21 คอลัมน์
      // Special: 22 คอลัมน์
      // Express: 23 คอลัมน์
      
      if (fileType === 'route_planning' && (headers.length < 20 || headers.length > 21)) {
        return {
          valid: false,
          message: `คุณเลือกประเภท "จัดเส้นทาง" (21 คอลัมน์) แต่ไฟล์มี ${headers.length} คอลัมน์ กรุณาตรวจสอบไฟล์หรือเลือกประเภทที่ถูกต้อง`
        };
      }
      
      if (fileType === 'special' && (headers.length < 21 || headers.length > 22)) {
        return {
          valid: false,
          message: `คุณเลือกประเภท "ออเดอร์พิเศษ" (22 คอลัมน์) แต่ไฟล์มี ${headers.length} คอลัมน์ กรุณาตรวจสอบไฟล์หรือเลือกประเภทที่ถูกต้อง`
        };
      }
      
      if (fileType === 'express' && headers.length < 22) {
        return {
          valid: false,
          message: `คุณเลือกประเภท "ส่งรายชิ้น (ด่วนพิเศษ)" (23 คอลัมน์) แต่ไฟล์มี ${headers.length} คอลัมน์ กรุณาตรวจสอบไฟล์หรือเลือกประเภทที่ถูกต้อง`
        };
      }

      // ตรวจสอบจำนวนคอลัมน์และข้อมูลตามประเภท
      if (fileType === 'route_planning') {
        // Route Planning: 21 คอลัมน์
        if (headers.length < 20) {
          return {
            valid: false,
            message: `ไฟล์ไม่ตรงกับรูปแบบ "จัดเส้นทาง" (ต้องมี 21 คอลัมน์ แต่พบ ${headers.length} คอลัมน์)`
          };
        }

        // ตรวจสอบข้อมูลในแถวแรก (orderNo[3], customerId[4], skuId[7])
        const row1 = dataRows[0];
        const orderNo = String(row1[3] || '').trim();
        const customerId = String(row1[4] || '').trim();
        const skuId = String(row1[7] || '').trim();

        if (!orderNo) {
          return {
            valid: false,
            message: 'ไฟล์ไม่ตรงกับรูปแบบ "จัดเส้นทาง": ไม่พบเลขที่ใบสั่งส่งในคอลัมน์ที่ 4'
          };
        }
        if (!customerId) {
          return {
            valid: false,
            message: 'ไฟล์ไม่ตรงกับรูปแบบ "จัดเส้นทาง": ไม่พบรหัสลูกค้าในคอลัมน์ที่ 5'
          };
        }
        if (!skuId) {
          return {
            valid: false,
            message: 'ไฟล์ไม่ตรงกับรูปแบบ "จัดเส้นทาง": ไม่พบรหัสสินค้าในคอลัมน์ที่ 8'
          };
        }

      } else if (fileType === 'express') {
        // Express: 23 คอลัมน์
        if (headers.length < 22) {
          return {
            valid: false,
            message: `ไฟล์ไม่ตรงกับรูปแบบ "ส่งรายชิ้น (ด่วนพิเศษ)" (ต้องมี 23 คอลัมน์ แต่พบ ${headers.length} คอลัมน์)`
          };
        }

        // ตรวจสอบข้อมูลในแถวแรก (orderNo[2], customerId[3], skuId[6])
        const row1 = dataRows[0];
        const orderNo = String(row1[2] || '').trim();
        const customerId = String(row1[3] || '').trim();
        const skuId = String(row1[6] || '').trim();

        if (!orderNo) {
          return {
            valid: false,
            message: 'ไฟล์ไม่ตรงกับรูปแบบ "ส่งรายชิ้น (ด่วนพิเศษ)": ไม่พบเลขที่ใบสั่งส่งในคอลัมน์ที่ 3'
          };
        }
        if (!customerId) {
          return {
            valid: false,
            message: 'ไฟล์ไม่ตรงกับรูปแบบ "ส่งรายชิ้น (ด่วนพิเศษ)": ไม่พบรหัสลูกค้าในคอลัมน์ที่ 4'
          };
        }
        if (!skuId) {
          return {
            valid: false,
            message: 'ไฟล์ไม่ตรงกับรูปแบบ "ส่งรายชิ้น (ด่วนพิเศษ)": ไม่พบรหัสสินค้าในคอลัมน์ที่ 7'
          };
        }

      } else if (fileType === 'special') {
        // Special: 22 คอลัมน์
        if (headers.length < 21) {
          return {
            valid: false,
            message: `ไฟล์ไม่ตรงกับรูปแบบ "ออเดอร์พิเศษ (สินค้าของแถม)" (ต้องมี 22 คอลัมน์ แต่พบ ${headers.length} คอลัมน์)`
          };
        }

        // ตรวจสอบข้อมูลในแถวแรก (orderNo[3], customerId[4], skuId[7])
        const row1 = dataRows[0];
        const orderNo = String(row1[3] || '').trim();
        const customerId = String(row1[4] || '').trim();
        const skuId = String(row1[7] || '').trim();

        if (!orderNo) {
          return {
            valid: false,
            message: 'ไฟล์ไม่ตรงกับรูปแบบ "ออเดอร์พิเศษ (สินค้าของแถม)": ไม่พบเลขที่ใบสั่งส่งในคอลัมน์ที่ 4'
          };
        }
        if (!customerId) {
          return {
            valid: false,
            message: 'ไฟล์ไม่ตรงกับรูปแบบ "ออเดอร์พิเศษ (สินค้าของแถม)": ไม่พบรหัสลูกค้าในคอลัมน์ที่ 5'
          };
        }
        if (!skuId) {
          return {
            valid: false,
            message: 'ไฟล์ไม่ตรงกับรูปแบบ "ออเดอร์พิเศษ (สินค้าของแถม)": ไม่พบรหัสสินค้าในคอลัมน์ที่ 8'
          };
        }
      }

      return { valid: true };
    };

    const validation = validateFileStructure();
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 }
      );
    }

    const ordersByOrderNo: { [key: string]: any } = {};

    for (const row of dataRows) {
      if (fileType === 'route_planning') {
        const orderNo = String(row[3] || '').trim();
        if (!orderNo) continue;

        if (!ordersByOrderNo[orderNo]) {
          const pickupDateTimeStr = String(row[19] || '').trim();
          let pickupDateTime = null;
          if (pickupDateTimeStr && pickupDateTimeStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            pickupDateTime = pickupDateTimeStr;
          }

          // Use defaultWarehouseId from form instead of reading from CSV file
          ordersByOrderNo[orderNo] = {
            order_no: orderNo,
            order_type: 'route_planning',
            order_date: parseDate(String(row[0] || '').trim()) || new Date().toISOString().split('T')[0],
            delivery_date: deliveryDate || new Date().toISOString().split('T')[0],
            warehouse_id: defaultWarehouseId || null,
            payment_type: String(row[2] || '').toLowerCase().includes('เครดิต') ? 'credit' : 'cash',
            customer_id: String(row[4] || '').trim().substring(0, 50) || null,
            shop_name: String(row[5] || '').trim().substring(0, 255),
            province: String(row[6] || '').trim().substring(0, 100),
            pickup_datetime: pickupDateTime,
            notes: String(row[20] || '').trim(),
            text_field_long_1: String(row[17] || '').trim(),
            text_field_additional_4: String(row[18] || '').trim().substring(0, 255),
            status: 'draft',
            import_file_name: file.name.substring(0, 255),
            import_file_type: 'route_planning',
            items: []
          };
        }

        ordersByOrderNo[orderNo].items.push({
          line_no: ordersByOrderNo[orderNo].items.length + 1,
          sku_id: String(row[7] || '').trim().substring(0, 50) || null,
          sku_name: String(row[8] || '').trim().substring(0, 255),
          number_field_additional_1: parseFloat(row[9]) || 0,
          order_qty: parseFloat(row[10]) || 0,
          order_weight: parseFloat(row[11]) || 0,
          pack_all: parseInt(row[12]) || 0,
          pack_12_bags: parseInt(row[13]) || 0,
          pack_4: parseInt(row[14]) || 0,
          pack_6: parseInt(row[15]) || 0,
          pack_2: 0,
          pack_1: parseInt(row[16]) || 0
        });
      } else if (fileType === 'express') {
        const orderNo = String(row[2] || '').trim();
        if (!orderNo) continue;

        if (!ordersByOrderNo[orderNo]) {
          const customerId = String(row[3] || '').trim() || 'CUST-DEFAULT';

          ordersByOrderNo[orderNo] = {
            order_no: orderNo,
            order_type: 'express',
            order_date: parseDate(String(row[0] || '').trim()) || new Date().toISOString().split('T')[0],
            delivery_date: deliveryDate || new Date().toISOString().split('T')[0],
            sequence_no: String(row[0] || '').trim().substring(0, 50),
            warehouse_id: defaultWarehouseId || 'WH01',
            payment_type: String(row[1] || '').toLowerCase().includes('เครดิต') ? 'credit' : 'cash',
            customer_id: customerId.substring(0, 50),
            shop_name: String(row[4] || '').trim().substring(0, 255),
            province: String(row[5] || '').trim().substring(0, 100),
            phone: String(row[19] || '').trim().substring(0, 50),
            notes: String(row[21] || '').trim(),
            notes_additional: String(row[22] || '').trim(),
            text_field_long_1: String(row[17] || '').trim(),
            text_field_additional_1: String(row[18] || '').trim().substring(0, 255),
            text_field_additional_4: String(row[20] || '').trim().substring(0, 255),
            status: 'draft',
            import_file_name: file.name.substring(0, 255),
            import_file_type: 'express',
            items: []
          };
        }

        ordersByOrderNo[orderNo].items.push({
          line_no: ordersByOrderNo[orderNo].items.length + 1,
          sku_id: String(row[6] || '').trim().substring(0, 50) || null,
          sku_name: String(row[7] || '').trim().substring(0, 255),
          number_field_additional_1: parseFloat(row[8]) || 0,
          order_qty: parseFloat(row[9]) || 0,
          order_weight: parseFloat(row[10]) || 0,
          pack_all: parseInt(row[11]) || 0,
          pack_12_bags: parseInt(row[12]) || 0,
          pack_4: parseInt(row[13]) || 0,
          pack_6: parseInt(row[14]) || 0,
          pack_2: parseInt(row[15]) || 0,
          pack_1: parseInt(row[16]) || 0
        });
      } else if (fileType === 'special') {
        // Special CSV Format: 21 columns (เหมือน Route Planning)
        // 0: วันที่, 1: คลัง, 2: เครดิต/เงินสด, 3: เลขที่ใบสั่งส่ง,
        // 4: รหัสลูกค้า/ผู้ขาย, 5: ชื่อร้านค้า, 6: จังหวัด, 7: รหัสสินค้า,
        // 8: ชื่อสินค้า, 9: ฟิลด์เพิ่มเติมประเภทตัวเลข 1, 10: จำนวน, 11: น้ำหนัก,
        // 12: จำนวนแพ็ครวม, 13: แพ็ค 12 ถุง, 14: แพ็ค 4, 15: แพ็ค 6, 16: แพ็ค 1,
        // 17: ประเภทข้อความแบบยาว 1, 18: ประเภทข้อความเพิ่มเติม 4, 19: วัน เวลารับสินค้า, 20: หมายเหตุ
        const orderNo = String(row[3] || '').trim();
        if (!orderNo) continue;

        if (!ordersByOrderNo[orderNo]) {
          const customerId = String(row[4] || '').trim() || 'CUST-DEFAULT';
          // ใช้ warehouse_id จากฟอร์มที่ผู้ใช้เลือก
          const warehouseId = defaultWarehouseId || 'WH01';
          const pickupDateTimeStr = String(row[19] || '').trim();
          let pickupDateTime = null;
          if (pickupDateTimeStr && pickupDateTimeStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            pickupDateTime = pickupDateTimeStr;
          }

          ordersByOrderNo[orderNo] = {
            order_no: orderNo,
            order_type: 'special',
            order_date: parseDate(String(row[0] || '').trim()) || new Date().toISOString().split('T')[0],
            delivery_date: deliveryDate || new Date().toISOString().split('T')[0],
            warehouse_id: warehouseId,
            payment_type: String(row[2] || '').toLowerCase().includes('เครดิต') ? 'credit' : 'cash',
            customer_id: customerId.substring(0, 50),
            shop_name: String(row[5] || '').trim().substring(0, 255),
            province: String(row[6] || '').trim().substring(0, 100),
            pickup_datetime: pickupDateTime,
            notes: String(row[20] || '').trim() || '', // หมายเหตุ (เพิ่มเติม)
            notes_additional: String(row[21] || '').trim() || '', // หมายเหตุ (จัดส่ง) - คอลัมน์ที่ 21
            text_field_long_1: String(row[17] || '').trim() || '',
            text_field_additional_4: String(row[18] || '').trim().substring(0, 255) || '',
            status: 'draft',
            import_file_name: file.name.substring(0, 255),
            import_file_type: 'special',
            items: []
          };
        }

        ordersByOrderNo[orderNo].items.push({
          line_no: ordersByOrderNo[orderNo].items.length + 1,
          sku_id: String(row[7] || '').trim().substring(0, 50) || null,
          sku_name: String(row[8] || '').trim().substring(0, 255),
          number_field_additional_1: parseFloat(row[9]) || 0,
          order_qty: parseFloat(row[10]) || 0,
          order_weight: parseFloat(row[11]) || 0,
          pack_all: parseInt(row[12]) || 0,
          pack_12_bags: parseInt(row[13]) || 0,
          pack_4: parseInt(row[14]) || 0,
          pack_6: parseInt(row[15]) || 0,
          pack_2: 0,
          pack_1: parseInt(row[16]) || 0
        });
      }
    }

    const orders = Object.values(ordersByOrderNo);
    const conflicts = [];
    const newOrders = [];
    const duplicates = [];

    // Helper function to compare and detail changes
    function compareOrders(existing: any, newOrder: any) {
      const changes: any = {
        hasChanges: false,
        itemChanges: [],
        headerChanges: []
      };

      // Compare header fields that might change
      const fieldsToCompare = [
        { field: 'shop_name', label: 'ชื่อร้าน' },
        { field: 'province', label: 'จังหวัด' },
        { field: 'delivery_date', label: 'วันที่ส่ง' },
        { field: 'notes', label: 'หมายเหตุ' },
        { field: 'phone', label: 'เบอร์โทร' }
      ];

      for (const { field, label } of fieldsToCompare) {
        if (existing[field] !== newOrder[field]) {
          changes.hasChanges = true;
          changes.headerChanges.push({
            field: label,
            oldValue: existing[field] || '-',
            newValue: newOrder[field] || '-'
          });
        }
      }

      const existingItems = existing.items || [];
      const newItems = newOrder.items;

      // Define item data type
      type ItemData = {
        sku_name: string;
        qty: number;
        weight: number;
        pack: number;
        pack_12_bags: number;
        pack_4: number;
        pack_6: number;
        pack_2: number;
        pack_1: number;
      };

      // Create maps for comparison
      const existingSkuMap = new Map<string, ItemData>(
        existingItems.map((item: any) => [
          item.sku_id,
          {
            sku_name: item.sku_name,
            qty: item.order_qty,
            weight: item.order_weight,
            pack: item.pack_all,
            pack_12_bags: item.pack_12_bags || 0,
            pack_4: item.pack_4 || 0,
            pack_6: item.pack_6 || 0,
            pack_2: item.pack_2 || 0,
            pack_1: item.pack_1 || 0
          }
        ])
      );

      const newSkuMap = new Map<string, ItemData>(
        newItems.map((item: any) => [
          item.sku_id,
          {
            sku_name: item.sku_name,
            qty: item.order_qty,
            weight: item.order_weight,
            pack: item.pack_all,
            pack_12_bags: item.pack_12_bags || 0,
            pack_4: item.pack_4 || 0,
            pack_6: item.pack_6 || 0,
            pack_2: item.pack_2 || 0,
            pack_1: item.pack_1 || 0
          }
        ])
      );

      // Check for removed items
      for (const [skuId, existingData] of existingSkuMap) {
        if (!newSkuMap.has(skuId)) {
          changes.hasChanges = true;
          changes.itemChanges.push({
            sku_id: skuId,
            sku_name: existingData.sku_name,
            changeType: 'removed',
            message: `ลบสินค้า ${existingData.sku_name} (${skuId})`
          });
        }
      }

      // Check for new items and modified items
      for (const [skuId, newData] of newSkuMap) {
        const existingData = existingSkuMap.get(skuId);

        if (!existingData) {
          // New item
          changes.hasChanges = true;
          changes.itemChanges.push({
            sku_id: skuId,
            sku_name: newData.sku_name,
            changeType: 'added',
            message: `เพิ่มสินค้า ${newData.sku_name} (${skuId})`,
            newQty: newData.qty,
            newWeight: newData.weight,
            newPack: newData.pack
          });
        } else {
          // Check if item data changed
          const itemChanges = [];

          if (existingData.qty !== newData.qty) {
            itemChanges.push(`จำนวน: ${existingData.qty} → ${newData.qty}`);
          }
          if (existingData.weight !== newData.weight) {
            itemChanges.push(`น้ำหนัก: ${existingData.weight} → ${newData.weight} kg`);
          }
          if (existingData.pack !== newData.pack) {
            itemChanges.push(`แพ็ครวม: ${existingData.pack} → ${newData.pack}`);
          }
          if (existingData.pack_12_bags !== newData.pack_12_bags) {
            itemChanges.push(`แพ็ค 12 ถุง: ${existingData.pack_12_bags} → ${newData.pack_12_bags}`);
          }
          if (existingData.pack_4 !== newData.pack_4) {
            itemChanges.push(`แพ็ค 4: ${existingData.pack_4} → ${newData.pack_4}`);
          }
          if (existingData.pack_6 !== newData.pack_6) {
            itemChanges.push(`แพ็ค 6: ${existingData.pack_6} → ${newData.pack_6}`);
          }
          if (existingData.pack_2 !== newData.pack_2) {
            itemChanges.push(`แพ็ค 2: ${existingData.pack_2} → ${newData.pack_2}`);
          }
          if (existingData.pack_1 !== newData.pack_1) {
            itemChanges.push(`แพ็ค 1: ${existingData.pack_1} → ${newData.pack_1}`);
          }

          if (itemChanges.length > 0) {
            changes.hasChanges = true;
            changes.itemChanges.push({
              sku_id: skuId,
              sku_name: newData.sku_name,
              changeType: 'modified',
              message: `${newData.sku_name} (${skuId})`,
              details: itemChanges,
              oldQty: existingData.qty,
              newQty: newData.qty,
              oldWeight: existingData.weight,
              newWeight: newData.weight,
              oldPack: existingData.pack,
              newPack: newData.pack
            });
          }
        }
      }

      return changes;
    }

    for (const orderData of orders) {
      const { items, ...order } = orderData;
      const { data: existingOrder } = await ordersService.getOrderByOrderNo(order.order_no);

      if (existingOrder) {
        const comparison = compareOrders(existingOrder, orderData);

        if (comparison.hasChanges) {
          conflicts.push({
            order_no: order.order_no,
            customer_id: order.customer_id,
            shop_name: order.shop_name,
            existing: existingOrder,
            new: orderData,
            changes: comparison
          });
        } else {
          duplicates.push(order.order_no);
        }
      } else {
        newOrders.push(orderData);
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json({
        data: {
          hasConflicts: true,
          conflicts,
          orders,
          stats: {
            total: orders.length,
            new: newOrders.length,
            duplicates: duplicates.length,
            conflicts: conflicts.length
          }
        },
        error: null
      });
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedDuplicates = 0;
    const errors: string[] = [];

    for (const orderData of newOrders) {
      const { items, ...order } = orderData;

      const totalItems = items.length;
      const totalQty = items.reduce((sum: number, item: any) => sum + item.order_qty, 0);
      const totalWeight = items.reduce((sum: number, item: any) => sum + (item.order_weight || 0), 0);
      const totalPackAll = items.reduce((sum: number, item: any) => sum + item.pack_all, 0);
      const pack12Bags = items.reduce((sum: number, item: any) => sum + item.pack_12_bags, 0);
      const pack4 = items.reduce((sum: number, item: any) => sum + item.pack_4, 0);
      const pack6 = items.reduce((sum: number, item: any) => sum + item.pack_6, 0);
      const pack2 = items.reduce((sum: number, item: any) => sum + item.pack_2, 0);
      const pack1 = items.reduce((sum: number, item: any) => sum + item.pack_1, 0);

      try {
        // เช็คอีกครั้งก่อนสร้าง เพื่อป้องกัน race condition
        const { data: doubleCheckOrder } = await ordersService.getOrderByOrderNo(order.order_no);
        
        if (doubleCheckOrder) {
          console.log(`[RACE CONDITION PREVENTED] Order ${order.order_no} already exists, skipping...`);
          skippedDuplicates++;
          continue;
        }

        const { data: createdOrder, error } = await ordersService.createOrder({
            ...order,
            total_items: totalItems,
            total_qty: totalQty,
            total_weight: totalWeight,
            total_pack_all: totalPackAll,
            pack_12_bags: pack12Bags,
            pack_4: pack4,
            pack_6: pack6,
            pack_2: pack2,
            pack_1: pack1
        });

        if (error || !createdOrder) {
            // ตรวจสอบว่าเป็น duplicate key error หรือไม่
            if (error && (error.includes('duplicate') || error.includes('unique'))) {
              console.log(`[DUPLICATE KEY] Order ${order.order_no} already exists (caught by DB constraint)`);
              skippedDuplicates++;
              continue;
            }
            
            console.error(`Error creating order ${order.order_no}:`, error || 'No data returned');
            throw new Error(error || 'Failed to create order');
        }

        const itemsWithOrderId = items.map((item: any) => ({
            ...item,
            order_id: createdOrder.order_id
        }));

        const { error: itemsError } = await ordersService.createOrderItems(itemsWithOrderId);

        if (itemsError) {
            console.error(`Error creating items for order ${order.order_no}:`, itemsError);
            await ordersService.deleteOrder(createdOrder.order_id);
            throw new Error(itemsError || 'Failed to create order items');
        }
        successCount++;
      } catch (e: any) {
        console.error(`Error creating order ${order.order_no}:`, e.message, e);
        errors.push(`${order.order_no}: ${e.message}`);
        errorCount++;
      }
    }

    return NextResponse.json({
      data: {
        message: `Import completed: ${successCount} created, ${duplicates.length} duplicates skipped, ${errorCount} errors`,
        successCount,
        duplicateCount: duplicates.length,
        errorCount,
        totalOrders: orders.length
      },
      error: null
    });

  } catch (error: any) {
    console.error('Error importing orders:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
