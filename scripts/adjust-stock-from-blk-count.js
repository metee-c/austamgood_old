require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ฟังก์ชันแปลงวันที่จาก Excel format (dd/mm/yyyy ในปี พ.ศ.) เป็น ISO format
function parseThaiDate(dateStr) {
  if (!dateStr || dateStr === '-' || dateStr === '') return null;
  
  try {
    // Format: dd/mm/yyyy (พ.ศ.)
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const yearBE = parseInt(parts[2]); // ปี พ.ศ.
    const yearCE = yearBE - 543; // แปลงเป็น ค.ศ.
    
    // สร้าง ISO date string
    const isoDate = `${yearCE}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return isoDate;
  } catch (error) {
    console.error(`Error parsing date: ${dateStr}`, error);
    return null;
  }
}

async function main() {
  console.log('=== Stock Adjustment from BLK Physical Count ===\n');

  // 1. อ่านไฟล์ Excel
  console.log('1. อ่านไฟล์ BLK.xlsx...');
  const workbook = XLSX.readFile('BLK.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  
  console.log(`   พบข้อมูล ${excelData.length} แถว`);
  
  // 2. จัดกลุ่มข้อมูลตามโลเคชั่น
  console.log('\n2. จัดกลุ่มข้อมูลตามโลเคชั่น...');
  const locationMap = new Map();
  
  excelData.forEach(row => {
    const locationId = row['ตำแหน่ง'];
    if (!locationMap.has(locationId)) {
      locationMap.set(locationId, []);
    }
    locationMap.get(locationId).push(row);
  });
  
  console.log(`   พบ ${locationMap.size} โลเคชั่น`);
  
  // 3. ดึงข้อมูลสต็อกปัจจุบันในระบบสำหรับโลเคชั่นเหล่านี้
  console.log('\n3. ดึงข้อมูลสต็อกปัจจุบันในระบบ...');
  const locations = Array.from(locationMap.keys());
  
  const { data: currentBalances, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .in('location_id', locations)
    .gt('total_piece_qty', 0);
  
  if (balanceError) {
    console.error('Error fetching balances:', balanceError);
    return;
  }
  
  console.log(`   พบสต็อกในระบบ ${currentBalances?.length || 0} รายการ`);
  
  // 4. วิเคราะห์ความแตกต่าง
  console.log('\n4. วิเคราะห์ความแตกต่างระหว่างการนับกับระบบ...\n');
  
  const adjustments = [];
  let totalLocations = 0;
  let locationsWithDiff = 0;
  
  for (const [locationId, countedItems] of locationMap.entries()) {
    totalLocations++;
    console.log(`\n--- ${locationId} ---`);
    
    // สร้าง map ของข้อมูลที่นับได้ (key: pallet_id)
    const countedMap = new Map();
    countedItems.forEach(item => {
      const palletId = item['รหัสพาเลท'];
      const skuId = item['รหัสสินค้า'];
      const qty = parseInt(item['ชิ้นรวม']) || 0;
      const status = item['ถูก / ผิด'];
      
      // ถ้าเป็น "ไม่มีของ" หรือ "-" ให้ข้าม
      if (status === 'ไม่มีของ' || palletId === '-' || skuId === '-') {
        return;
      }
      
      const key = `${palletId}|${skuId}`;
      countedMap.set(key, {
        palletId,
        skuId,
        qty,
        productionDate: parseThaiDate(item['วันผลิต']),
        expiryDate: parseThaiDate(item['วันหมดอายุ']),
        lotNo: null // ไม่มีข้อมูล lot_no ในไฟล์
      });
    });
    
    // สร้าง map ของสต็อกในระบบ (key: pallet_id)
    const systemMap = new Map();
    const systemBalances = currentBalances?.filter(b => b.location_id === locationId) || [];
    systemBalances.forEach(balance => {
      const key = `${balance.pallet_id}|${balance.sku_id}`;
      systemMap.set(key, balance);
    });
    
    console.log(`   นับได้: ${countedMap.size} รายการ, ในระบบ: ${systemMap.size} รายการ`);
    
    // เปรียบเทียบ
    let hasChanges = false;
    
    // 1. ตรวจสอบสิ่งที่นับได้แต่ไม่มีในระบบ (ต้องเพิ่ม)
    for (const [key, counted] of countedMap.entries()) {
      if (!systemMap.has(key)) {
        console.log(`   ➕ เพิ่ม: ${counted.palletId} (${counted.skuId}) = ${counted.qty} ชิ้น`);
        adjustments.push({
          type: 'ADD',
          locationId,
          palletId: counted.palletId,
          skuId: counted.skuId,
          qty: counted.qty,
          productionDate: counted.productionDate,
          expiryDate: counted.expiryDate,
          lotNo: counted.lotNo
        });
        hasChanges = true;
      } else {
        // ตรวจสอบว่าจำนวนตรงกันหรือไม่
        const systemBalance = systemMap.get(key);
        if (systemBalance.total_piece_qty !== counted.qty) {
          const diff = counted.qty - systemBalance.total_piece_qty;
          console.log(`   🔄 ปรับ: ${counted.palletId} (${counted.skuId}) จาก ${systemBalance.total_piece_qty} เป็น ${counted.qty} (${diff > 0 ? '+' : ''}${diff})`);
          adjustments.push({
            type: 'ADJUST',
            locationId,
            palletId: counted.palletId,
            skuId: counted.skuId,
            balanceId: systemBalance.balance_id,
            oldQty: systemBalance.total_piece_qty,
            newQty: counted.qty,
            diff: diff,
            productionDate: counted.productionDate,
            expiryDate: counted.expiryDate,
            lotNo: counted.lotNo || systemBalance.lot_no
          });
          hasChanges = true;
        }
      }
    }
    
    // 2. ตรวจสอบสิ่งที่มีในระบบแต่ไม่ได้นับ (ต้องลบ)
    for (const [key, systemBalance] of systemMap.entries()) {
      if (!countedMap.has(key)) {
        console.log(`   ➖ ลบ: ${systemBalance.pallet_id} (${systemBalance.sku_id}) = ${systemBalance.total_piece_qty} ชิ้น`);
        adjustments.push({
          type: 'REMOVE',
          locationId,
          palletId: systemBalance.pallet_id,
          skuId: systemBalance.sku_id,
          balanceId: systemBalance.balance_id,
          qty: systemBalance.total_piece_qty,
          lotNo: systemBalance.lot_no
        });
        hasChanges = true;
      }
    }
    
    // 3. ตรวจสอบโลเคชั่นที่ "ไม่มีของ" - ต้องลบทุกอย่างในโลเคชั่นนั้น
    const hasNoStock = countedItems.some(item => item['ถูก / ผิด'] === 'ไม่มีของ');
    if (hasNoStock && systemBalances.length > 0) {
      console.log(`   ⚠️  โลเคชั่นนี้ควรว่าง แต่มีสต็อก ${systemBalances.length} รายการในระบบ`);
      systemBalances.forEach(balance => {
        const key = `${balance.pallet_id}|${balance.sku_id}`;
        if (!countedMap.has(key)) { // ถ้ายังไม่ได้เพิ่มในรายการลบ
          console.log(`   ➖ ลบ: ${balance.pallet_id} (${balance.sku_id}) = ${balance.total_piece_qty} ชิ้น`);
          adjustments.push({
            type: 'REMOVE',
            locationId,
            palletId: balance.pallet_id,
            skuId: balance.sku_id,
            balanceId: balance.balance_id,
            qty: balance.total_piece_qty,
            lotNo: balance.lot_no
          });
          hasChanges = true;
        }
      });
    }
    
    if (hasChanges) {
      locationsWithDiff++;
    } else {
      console.log(`   ✅ ตรงกัน`);
    }
  }
  
  // 5. สรุปผล
  console.log('\n\n=== สรุปผล ===');
  console.log(`โลเคชั่นทั้งหมด: ${totalLocations}`);
  console.log(`โลเคชั่นที่มีความแตกต่าง: ${locationsWithDiff}`);
  console.log(`\nการปรับปรุงที่ต้องทำ: ${adjustments.length} รายการ`);
  
  const addCount = adjustments.filter(a => a.type === 'ADD').length;
  const adjustCount = adjustments.filter(a => a.type === 'ADJUST').length;
  const removeCount = adjustments.filter(a => a.type === 'REMOVE').length;
  
  console.log(`  - เพิ่ม: ${addCount} รายการ`);
  console.log(`  - ปรับจำนวน: ${adjustCount} รายการ`);
  console.log(`  - ลบ: ${removeCount} รายการ`);
  
  // 6. บันทึกผลลัพธ์เป็นไฟล์ JSON
  const fs = require('fs');
  fs.writeFileSync('blk-stock-adjustments.json', JSON.stringify(adjustments, null, 2));
  console.log('\n✅ บันทึกรายการปรับปรุงไว้ที่ blk-stock-adjustments.json');
  
  console.log('\n📝 ขั้นตอนต่อไป:');
  console.log('1. ตรวจสอบไฟล์ blk-stock-adjustments.json');
  console.log('2. รัน node scripts/apply-blk-stock-adjustments.js เพื่อทำการปรับปรุงจริง');
}

main().catch(console.error);
