// ตรวจสอบสต็อคที่ Dispatch, MRTD, PQTD vs เอกสารที่ยังไม่ได้สร้างใบโหลด
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== ตรวจสอบสต็อค Staging vs เอกสารที่ยังไม่ได้สร้างใบโหลด ===\n');

  // 1. หา Picklists ที่ยังไม่ได้สร้างใบโหลด
  const { data: pendingPicklists } = await supabase
    .from('picklists')
    .select('id, picklist_code')
    .eq('status', 'completed')
    .not('id', 'in', `(SELECT picklist_id FROM wms_loadlist_picklists)`);

  console.log(`📋 Picklists ที่ยังไม่ได้สร้างใบโหลด: ${pendingPicklists?.length || 0} ใบ`);
  if (pendingPicklists && pendingPicklists.length > 0) {
    console.log(pendingPicklists.map(p => p.picklist_code).join(', '));
  }

  // 2. หา Face Sheets ที่ยังไม่ได้สร้างใบโหลด
  const { data: pendingFaceSheets } = await supabase
    .from('face_sheets')
    .select('id, face_sheet_no')
    .eq('status', 'completed')
    .not('id', 'in', `(SELECT face_sheet_id FROM loadlist_face_sheets)`);

  console.log(`\n📄 Face Sheets ที่ยังไม่ได้สร้างใบโหลด: ${pendingFaceSheets?.length || 0} ใบ`);
  if (pendingFaceSheets && pendingFaceSheets.length > 0) {
    console.log(pendingFaceSheets.map(fs => fs.face_sheet_no).join(', '));
  }

  // 3. หา BFS ที่ยังไม่ได้สร้างใบโหลด
  const { data: pendingBFS } = await supabase
    .from('bonus_face_sheets')
    .select('id, face_sheet_no')
    .eq('status', 'completed')
    .not('id', 'in', `(SELECT bonus_face_sheet_id FROM wms_loadlist_bonus_face_sheets)`);

  console.log(`\n🎁 BFS ที่ยังไม่ได้สร้างใบโหลด: ${pendingBFS?.length || 0} ใบ`);
  if (pendingBFS && pendingBFS.length > 0) {
    console.log(pendingBFS.map(bfs => bfs.face_sheet_no).join(', '));
  }

  // 4. คำนวณสินค้าที่ควรมีจาก Picklists
  const expectedFromPicklists = new Map();
  if (pendingPicklists && pendingPicklists.length > 0) {
    const { data: picklistItems } = await supabase
      .from('picklist_items')
      .select('sku_id, quantity_picked')
      .in('picklist_id', pendingPicklists.map(p => p.id));

    picklistItems?.forEach(item => {
      const current = expectedFromPicklists.get(item.sku_id) || 0;
      expectedFromPicklists.set(item.sku_id, current + Number(item.quantity_picked));
    });
  }

  // 5. คำนวณสินค้าที่ควรมีจาก Face Sheets
  const expectedFromFaceSheets = new Map();
  if (pendingFaceSheets && pendingFaceSheets.length > 0) {
    const { data: faceSheetItems } = await supabase
      .from('face_sheet_items')
      .select('sku_id, quantity_picked')
      .in('face_sheet_id', pendingFaceSheets.map(fs => fs.id));

    faceSheetItems?.forEach(item => {
      const current = expectedFromFaceSheets.get(item.sku_id) || 0;
      expectedFromFaceSheets.set(item.sku_id, current + Number(item.quantity_picked));
    });
  }

  // 6. คำนวณสินค้าที่ควรมีจาก BFS
  const expectedFromBFS = new Map(); // sku_id -> { MRTD: qty, PQTD: qty }
  if (pendingBFS && pendingBFS.length > 0) {
    // ดึง packages ที่ storage_location = null (ย้ายไป staging แล้ว)
    const { data: bfsPackages } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, face_sheet_id')
      .in('face_sheet_id', pendingBFS.map(bfs => bfs.id))
      .is('storage_location', null);

    if (bfsPackages && bfsPackages.length > 0) {
      const { data: bfsItems } = await supabase
        .from('bonus_face_sheet_items')
        .select(`
          sku_id,
          quantity_picked,
          package_id,
          master_sku!inner(preparation_area)
        `)
        .in('package_id', bfsPackages.map(p => p.id));

      bfsItems?.forEach(item => {
        const prepArea = item.master_sku?.preparation_area;
        let location = 'Dispatch';
        if (prepArea?.startsWith('MR')) location = 'MRTD';
        else if (prepArea?.startsWith('PQ')) location = 'PQTD';

        const key = `${item.sku_id}_${location}`;
        const current = expectedFromBFS.get(key) || 0;
        expectedFromBFS.set(key, current + Number(item.quantity_picked));
      });
    }
  }

  // 7. รวมสินค้าที่ควรมีทั้งหมด
  const expectedStock = new Map(); // location_sku -> qty
  
  // จาก Picklists และ Face Sheets (Dispatch)
  for (const [skuId, qty] of expectedFromPicklists) {
    const key = `Dispatch_${skuId}`;
    expectedStock.set(key, (expectedStock.get(key) || 0) + qty);
  }
  for (const [skuId, qty] of expectedFromFaceSheets) {
    const key = `Dispatch_${skuId}`;
    expectedStock.set(key, (expectedStock.get(key) || 0) + qty);
  }
  
  // จาก BFS (MRTD/PQTD/Dispatch)
  for (const [key, qty] of expectedFromBFS) {
    const [skuId, location] = key.split('_');
    const mapKey = `${location}_${skuId}`;
    expectedStock.set(mapKey, (expectedStock.get(mapKey) || 0) + qty);
  }

  // 8. ดึงสต็อคจริงจาก Dispatch, MRTD, PQTD
  const { data: actualStock } = await supabase
    .from('wms_inventory_balances')
    .select(`
      sku_id,
      total_piece_qty,
      master_location!inner(location_code)
    `)
    .in('master_location.location_code', ['Dispatch', 'MRTD', 'PQTD'])
    .gt('total_piece_qty', 0);

  const actualStockMap = new Map();
  actualStock?.forEach(item => {
    const key = `${item.master_location.location_code}_${item.sku_id}`;
    actualStockMap.set(key, (actualStockMap.get(key) || 0) + Number(item.total_piece_qty));
  });

  // 9. เปรียบเทียบ
  console.log('\n\n=== เปรียบเทียบสต็อค Expected vs Actual ===\n');
  
  const allKeys = new Set([...expectedStock.keys(), ...actualStockMap.keys()]);
  const discrepancies = [];

  for (const key of allKeys) {
    const [location, skuId] = key.split('_');
    const expected = expectedStock.get(key) || 0;
    const actual = actualStockMap.get(key) || 0;
    const diff = actual - expected;

    if (diff !== 0) {
      // ดึงชื่อ SKU
      const { data: skuData } = await supabase
        .from('master_sku')
        .select('sku_name')
        .eq('sku_id', skuId)
        .single();

      discrepancies.push({
        location,
        sku_id: skuId,
        sku_name: skuData?.sku_name || skuId,
        expected,
        actual,
        difference: diff,
        status: diff > 0 ? 'มากเกิน' : 'น้อยเกิน'
      });
    }
  }

  if (discrepancies.length === 0) {
    console.log('✅ สต็อคถูกต้องทั้งหมด!');
  } else {
    console.log(`❌ พบความผิดพลาด ${discrepancies.length} รายการ:\n`);
    
    // จัดกลุ่มตาม location
    const byLocation = {};
    discrepancies.forEach(d => {
      if (!byLocation[d.location]) byLocation[d.location] = [];
      byLocation[d.location].push(d);
    });

    for (const [location, items] of Object.entries(byLocation)) {
      console.log(`\n📍 ${location}:`);
      items.forEach(item => {
        console.log(`  ${item.status === 'มากเกิน' ? '⬆️' : '⬇️'} ${item.sku_id} (${item.sku_name})`);
        console.log(`     Expected: ${item.expected}, Actual: ${item.actual}, Diff: ${item.difference > 0 ? '+' : ''}${item.difference}`);
      });
    }
  }

  console.log('\n\n=== สรุป ===');
  console.log(`เอกสารที่ยังไม่ได้สร้างใบโหลด: ${(pendingPicklists?.length || 0) + (pendingFaceSheets?.length || 0) + (pendingBFS?.length || 0)} เอกสาร`);
  console.log(`SKUs ที่ควรมี: ${expectedStock.size} รายการ`);
  console.log(`SKUs ที่มีจริง: ${actualStockMap.size} รายการ`);
  console.log(`ความผิดพลาด: ${discrepancies.length} รายการ`);
}

main().catch(console.error);
