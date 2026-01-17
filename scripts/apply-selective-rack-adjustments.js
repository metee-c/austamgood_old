const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // อ่าน discrepancies จากไฟล์
  const discrepancies = JSON.parse(fs.readFileSync('selective-rack-discrepancies.json', 'utf8'));
  
  console.log('=== Total discrepancies:', discrepancies.length);
  
  const systemOnly = discrepancies.filter(d => d.type === 'SYSTEM_ONLY');
  const excelOnly = discrepancies.filter(d => d.type === 'EXCEL_ONLY');
  
  console.log('--- SYSTEM_ONLY:', systemOnly.length);
  console.log('--- EXCEL_ONLY:', excelOnly.length);

  // ดึงข้อมูล default_location ของแต่ละ SKU
  const skuIds = [...new Set([...systemOnly.map(d => d.sku_id), ...excelOnly.map(d => d.sku_id)])];
  const { data: skuData, error: skuError } = await supabase
    .from('master_sku')
    .select('sku_id, default_location')
    .in('sku_id', skuIds);

  if (skuError) {
    console.error('Error fetching SKU data:', skuError);
    return;
  }

  const skuDefaultLocations = {};
  skuData.forEach(sku => {
    skuDefaultLocations[sku.sku_id] = sku.default_location;
  });

  console.log('\n=== SKU Default Locations ===');
  Object.entries(skuDefaultLocations).slice(0, 10).forEach(([sku, loc]) => {
    console.log(`  ${sku} -> ${loc || 'N/A'}`);
  });

  // ดึงข้อมูล pallet ทั้งหมดในระบบเพื่อหาว่า pallet อยู่ที่ไหน
  const palletIds = excelOnly.map(d => d.pallet_id).filter(p => p && p !== '-');
  console.log('\n=== Searching for', palletIds.length, 'pallets in system...');

  // ดึงทีละ batch
  let allPalletData = [];
  const batchSize = 100;
  for (let i = 0; i < palletIds.length; i += batchSize) {
    const batch = palletIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('wms_inventory_balances')
      .select('pallet_id, location_id, sku_id, total_piece_qty')
      .in('pallet_id', batch)
      .gt('total_piece_qty', 0);

    if (!error && data) {
      allPalletData = allPalletData.concat(data);
    }
  }

  console.log('=== Found', allPalletData.length, 'pallets in system');

  // สร้าง map ของ pallet -> current location
  const palletCurrentLocations = {};
  allPalletData.forEach(p => {
    palletCurrentLocations[p.pallet_id] = {
      location_id: p.location_id,
      sku_id: p.sku_id,
      qty: Number(p.total_piece_qty)
    };
  });

  // วิเคราะห์และสร้างรายการปรับสต็อก
  const adjustments = [];
  const errors = [];

  // 1. SYSTEM_ONLY: ย้ายไปบ้านหยิบ
  console.log('\n=== Processing SYSTEM_ONLY (move to default location) ===');
  for (const d of systemOnly) {
    const defaultLoc = skuDefaultLocations[d.sku_id];
    if (!defaultLoc) {
      errors.push({ ...d, error: 'No default location for SKU' });
      continue;
    }
    
    adjustments.push({
      type: 'MOVE',
      pallet_id: d.pallet_id,
      sku_id: d.sku_id,
      from_location: d.location,
      to_location: defaultLoc,
      qty: d.system_qty,
      reason: 'ย้ายไปบ้านหยิบ (ไม่พบในการนับสต็อก)'
    });
  }

  // 2. EXCEL_ONLY: หาและย้ายมา
  console.log('\n=== Processing EXCEL_ONLY (find and move here) ===');
  for (const d of excelOnly) {
    if (!d.pallet_id || d.pallet_id === '-') {
      // ไม่มี pallet_id - ข้าม
      continue;
    }

    const currentInfo = palletCurrentLocations[d.pallet_id];
    if (!currentInfo) {
      // ไม่พบ pallet ในระบบ - อาจต้องสร้างใหม่
      errors.push({ ...d, error: 'Pallet not found in system' });
      continue;
    }

    if (currentInfo.location_id === d.location) {
      // อยู่ที่เดียวกันแล้ว - ข้าม
      continue;
    }

    adjustments.push({
      type: 'MOVE',
      pallet_id: d.pallet_id,
      sku_id: d.sku_id,
      from_location: currentInfo.location_id,
      to_location: d.location,
      qty: currentInfo.qty,
      reason: 'ย้ายมาตามการนับสต็อก'
    });
  }

  console.log('\n=== Summary ===');
  console.log('Total adjustments to make:', adjustments.length);
  console.log('Errors:', errors.length);

  // แสดงตัวอย่าง adjustments
  console.log('\n=== Sample Adjustments (first 20) ===');
  adjustments.slice(0, 20).forEach((adj, i) => {
    console.log(`${i+1}. ${adj.type} | ${adj.pallet_id} | ${adj.from_location} -> ${adj.to_location} | ${adj.qty} pcs`);
  });

  // แสดง errors
  if (errors.length > 0) {
    console.log('\n=== Errors (first 20) ===');
    errors.slice(0, 20).forEach((err, i) => {
      console.log(`${i+1}. ${err.location} | ${err.sku_id} | ${err.pallet_id} | ${err.error}`);
    });
  }

  // บันทึกผลลัพธ์
  fs.writeFileSync('selective-rack-adjustments.json', JSON.stringify({ adjustments, errors }, null, 2));
  console.log('\n=== Saved to selective-rack-adjustments.json');

  // ถามว่าจะดำเนินการหรือไม่
  console.log('\n=== Ready to apply adjustments? ===');
  console.log('Run with --apply flag to execute the adjustments');
  
  if (process.argv.includes('--apply')) {
    console.log('\n=== APPLYING ADJUSTMENTS ===');
    await applyAdjustments(adjustments);
  }
}

async function applyAdjustments(adjustments) {
  let success = 0;
  let failed = 0;

  for (const adj of adjustments) {
    try {
      // อัพเดท location_id ใน wms_inventory_balances
      const { error } = await supabase
        .from('wms_inventory_balances')
        .update({ 
          location_id: adj.to_location,
          updated_at: new Date().toISOString()
        })
        .eq('pallet_id', adj.pallet_id)
        .eq('location_id', adj.from_location);

      if (error) {
        console.error(`Failed: ${adj.pallet_id} - ${error.message}`);
        failed++;
      } else {
        console.log(`✓ Moved ${adj.pallet_id}: ${adj.from_location} -> ${adj.to_location}`);
        success++;
      }
    } catch (err) {
      console.error(`Error: ${adj.pallet_id} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Done: ${success} success, ${failed} failed ===`);
}

main().catch(console.error);
