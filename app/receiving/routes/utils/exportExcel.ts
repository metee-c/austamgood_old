// ===== Export Excel Utility =====
// Phase 8: Export Excel ไม่มีราคา ตาม edit21.md

import * as XLSX from 'xlsx';

export interface ExportOptions {
  includePrice: boolean;
  format: 'tms' | 'simple';
}

/**
 * Export route plan to Excel with options
 */
export async function exportRoutePlanToExcel(
  planId: number,
  planCode: string,
  trips: any[],
  options: ExportOptions = { includePrice: true, format: 'simple' }
) {
  // สร้าง workbook
  const wb = XLSX.utils.book_new();
  
  for (const trip of trips) {
    const sheetData: any[] = [];
    
    // Header row
    const headers = [
      'ลำดับ',
      'เลขออเดอร์',
      'รหัสลูกค้า',
      'ชื่อร้าน',
      'ที่อยู่',
      'จังหวัด',
      'น้ำหนัก (กก.)',
      'จำนวน (ชิ้น)',
    ];
    
    // เพิ่มคอลัมน์ราคาถ้าต้องการ
    if (options.includePrice) {
      headers.push('ค่าขนส่ง');
    }
    
    sheetData.push(headers);
    
    // Data rows
    for (const stop of trip.stops || []) {
      const row: any[] = [
        stop.sequence_no,
        stop.order_no || stop.order_id || '',
        stop.customer_id || '',
        stop.stop_name || '',
        stop.address || '',
        stop.province || '',
        stop.load_weight_kg?.toFixed(2) || '',
        stop.load_units || '',
      ];
      
      if (options.includePrice) {
        row.push(''); // ราคาต่อจุด (ถ้ามี)
      }
      
      sheetData.push(row);
    }
    
    // Summary row (เฉพาะเมื่อไม่มีราคา)
    if (!options.includePrice) {
      sheetData.push([]);
      sheetData.push([
        'รวม', '', '', '', '', '',
        trip.total_weight_kg?.toFixed(2) || '',
        trip.stops?.reduce((sum: number, s: any) => sum + (s.load_units || 0), 0) || ''
      ]);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    
    // ปรับความกว้างคอลัมน์
    ws['!cols'] = [
      { wch: 8 },   // ลำดับ
      { wch: 15 },  // เลขออเดอร์
      { wch: 12 },  // รหัสลูกค้า
      { wch: 30 },  // ชื่อร้าน
      { wch: 40 },  // ที่อยู่
      { wch: 15 },  // จังหวัด
      { wch: 12 },  // น้ำหนัก
      { wch: 12 },  // จำนวน
    ];
    
    if (options.includePrice) {
      ws['!cols'].push({ wch: 12 }); // ค่าขนส่ง
    }
    
    const sheetName = `คัน ${trip.daily_trip_number || trip.trip_sequence}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Excel sheet name max 31 chars
  }
  
  // Download
  const fileName = options.includePrice
    ? `route_plan_${planCode}_full.xlsx`
    : `route_plan_${planCode}_routes_only.xlsx`;
    
  XLSX.writeFile(wb, fileName);
  
  return fileName;
}

/**
 * Export route plan summary (all trips in one sheet)
 */
export async function exportRoutePlanSummary(
  planId: number,
  planCode: string,
  planDate: string,
  trips: any[],
  options: ExportOptions = { includePrice: false, format: 'simple' }
) {
  const wb = XLSX.utils.book_new();
  const sheetData: any[] = [];
  
  // Header
  const headers = [
    'คัน',
    'ลำดับ',
    'เลขออเดอร์',
    'ชื่อร้าน',
    'ที่อยู่',
    'น้ำหนัก (กก.)',
    'จำนวน (ชิ้น)',
  ];
  
  if (options.includePrice) {
    headers.push('ค่าขนส่ง');
  }
  
  sheetData.push(headers);
  
  // Data
  for (const trip of trips) {
    const tripNumber = trip.daily_trip_number || trip.trip_sequence;
    
    for (const stop of trip.stops || []) {
      const row: any[] = [
        tripNumber,
        stop.sequence_no,
        stop.order_no || stop.order_id || '',
        stop.stop_name || '',
        stop.address || '',
        stop.load_weight_kg?.toFixed(2) || '',
        stop.load_units || '',
      ];
      
      if (options.includePrice) {
        row.push('');
      }
      
      sheetData.push(row);
    }
  }
  
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  
  // ปรับความกว้างคอลัมน์
  ws['!cols'] = [
    { wch: 8 },   // คัน
    { wch: 8 },   // ลำดับ
    { wch: 15 },  // เลขออเดอร์
    { wch: 30 },  // ชื่อร้าน
    { wch: 40 },  // ที่อยู่
    { wch: 12 },  // น้ำหนัก
    { wch: 12 },  // จำนวน
  ];
  
  if (options.includePrice) {
    ws['!cols'].push({ wch: 12 });
  }
  
  XLSX.utils.book_append_sheet(wb, ws, 'รายการทั้งหมด');
  
  const fileName = options.includePrice
    ? `route_summary_${planCode}_full.xlsx`
    : `route_summary_${planCode}_routes_only.xlsx`;
    
  XLSX.writeFile(wb, fileName);
  
  return fileName;
}
