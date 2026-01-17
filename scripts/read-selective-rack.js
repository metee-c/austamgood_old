const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // อ่านไฟล์ Excel
  const filePath = path.join(__dirname, '..', 'Selective Rack.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const excelData = XLSX.utils.sheet_to_json(sheet);

  console.log('=== Total rows in Excel:', excelData.length);

  // ดึงโลเคชั่นทั้งหมดจากไฟล์
  const excelLocations = new Set(excelData.map(row => row['ตำแหน่ง']));
  console.log('=== Unique locations in Excel:', excelLocations.size);

  // สร้าง map ของข้อมูลจาก Excel (location -> array of items)
  const excelMap = {};
  excelData.forEach(row => {
    const loc = row['ตำแหน่ง'];
    if (!excelMap[loc]) excelMap[loc] = [];
    if (row['สถานะ'] !== 'ว่าง' && row['รหัสสินค้า'] !== '-') {
      excelMap[loc].push({
        sku_id: row['รหัสสินค้า'],
        pallet_id: row['รหัสพาเลท'],
        qty: row['ชิ้นรวม'],
        status: row['ถูก / ผิด'] || null
      });
    }
  });

  // ดึงข้อมูลจากระบบ - inventory_balances ที่อยู่ใน Selective Rack locations
  // ดึงทีละ batch เพราะอาจมีข้อมูลเยอะ
  let allSystemData = [];
  
  // ดึงทั้ง A และ B zones
  for (const prefix of ['A%', 'B%']) {
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: batch, error } = await supabase
        .from('wms_inventory_balances')
        .select('location_id, sku_id, pallet_id, total_piece_qty, reserved_piece_qty')
        .like('location_id', prefix)
        .gt('total_piece_qty', 0)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error fetching system data:', error);
        return;
      }

      if (!batch || batch.length === 0) break;
      allSystemData = allSystemData.concat(batch);
      if (batch.length < pageSize) break;
      page++;
    }
  }

  const systemData = allSystemData;

  console.log('=== Total records in system for A% locations:', systemData.length);

  // กรองเฉพาะ locations ที่อยู่ในไฟล์
  const filteredSystemData = systemData.filter(row => excelLocations.has(row.location_id));
  console.log('=== Records matching Excel locations:', filteredSystemData.length);

  // สร้าง map ของข้อมูลจากระบบ (location -> array of items)
  const systemMap = {};
  filteredSystemData.forEach(row => {
    const loc = row.location_id;
    if (!systemMap[loc]) systemMap[loc] = [];
    systemMap[loc].push({
      sku_id: row.sku_id,
      pallet_id: row.pallet_id,
      qty: Number(row.total_piece_qty)
    });
  });

  // เปรียบเทียบ
  const discrepancies = [];
  const locationArray = Array.from(excelLocations);
  
  // 1. ตรวจสอบแต่ละ location ในไฟล์
  for (const loc of locationArray) {
    const excelItems = excelMap[loc] || [];
    const systemItems = systemMap[loc] || [];

    // สร้าง key สำหรับเปรียบเทียบ (pallet_id)
    const excelPallets = new Map(excelItems.map(i => [i.pallet_id, i]));
    const systemPallets = new Map(systemItems.map(i => [i.pallet_id, i]));

    // หา pallets ที่อยู่ในระบบแต่ไม่อยู่ในไฟล์ (ต้องย้ายไปบ้านหยิบ)
    for (const [palletId, sysItem] of systemPallets) {
      if (!excelPallets.has(palletId)) {
        discrepancies.push({
          type: 'SYSTEM_ONLY',
          location: loc,
          sku_id: sysItem.sku_id,
          pallet_id: palletId,
          system_qty: sysItem.qty,
          excel_qty: 0,
          action: 'ย้ายไปบ้านหยิบ'
        });
      }
    }

    // หา pallets ที่อยู่ในไฟล์แต่ไม่อยู่ในระบบ (ต้องหาว่าอยู่ที่ไหนแล้วย้ายมา)
    for (const [palletId, excelItem] of excelPallets) {
      if (!systemPallets.has(palletId)) {
        discrepancies.push({
          type: 'EXCEL_ONLY',
          location: loc,
          sku_id: excelItem.sku_id,
          pallet_id: palletId,
          system_qty: 0,
          excel_qty: excelItem.qty,
          action: 'หาและย้ายมาที่นี่'
        });
      } else {
        // ตรวจสอบจำนวน
        const sysItem = systemPallets.get(palletId);
        if (sysItem.qty !== excelItem.qty) {
          discrepancies.push({
            type: 'QTY_MISMATCH',
            location: loc,
            sku_id: excelItem.sku_id,
            pallet_id: palletId,
            system_qty: sysItem.qty,
            excel_qty: excelItem.qty,
            action: 'ปรับจำนวน'
          });
        }
      }
    }
  }

  console.log('\n=== Discrepancies found:', discrepancies.length);
  
  // แยกตามประเภท
  const systemOnly = discrepancies.filter(d => d.type === 'SYSTEM_ONLY');
  const excelOnly = discrepancies.filter(d => d.type === 'EXCEL_ONLY');
  const qtyMismatch = discrepancies.filter(d => d.type === 'QTY_MISMATCH');

  console.log('\n--- SYSTEM_ONLY (ในระบบมี แต่ไฟล์ไม่มี - ต้องย้ายไปบ้านหยิบ):', systemOnly.length);
  systemOnly.slice(0, 20).forEach(d => {
    console.log(`  ${d.location} | ${d.sku_id} | ${d.pallet_id} | Sys: ${d.system_qty}`);
  });

  console.log('\n--- EXCEL_ONLY (ไฟล์มี แต่ระบบไม่มี - ต้องหาและย้ายมา):', excelOnly.length);
  excelOnly.slice(0, 20).forEach(d => {
    console.log(`  ${d.location} | ${d.sku_id} | ${d.pallet_id} | Excel: ${d.excel_qty}`);
  });

  console.log('\n--- QTY_MISMATCH (จำนวนไม่ตรง):', qtyMismatch.length);
  qtyMismatch.slice(0, 20).forEach(d => {
    console.log(`  ${d.location} | ${d.sku_id} | ${d.pallet_id} | Sys: ${d.system_qty} vs Excel: ${d.excel_qty}`);
  });

  // บันทึกผลลัพธ์
  const fs = require('fs');
  fs.writeFileSync('selective-rack-discrepancies.json', JSON.stringify(discrepancies, null, 2));
  console.log('\n=== Saved to selective-rack-discrepancies.json');
}

main().catch(console.error);
