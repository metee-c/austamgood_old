/**
 * ตรวจสอบสต็อกที่ Dispatch และเอกสารที่ยังแสดงในแท็บ "จัดสินค้าเสร็จ"
 * หลังจากยืนยันโหลด loadlist LD-20260114-0015 แล้ว
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDispatchAfterLoading() {
  console.log('🔍 ตรวจสอบสต็อกที่ Dispatch และเอกสารที่ยังแสดงอยู่...\n');

  // 1. ตรวจสอบ loadlist LD-20260114-0015
  console.log('📦 1. ตรวจสอบ loadlist LD-20260114-0015:');
  const { data: loadlist, error: loadlistError } = await supabase
    .from('loadlists')
    .select('*')
    .eq('loadlist_code', 'LD-20260114-0015')
    .single();

  if (loadlistError) {
    console.error('❌ Error:', loadlistError.message);
    return;
  }

  console.log(`   Status: ${loadlist.status}`);
  console.log(`   Created: ${loadlist.created_at}`);
  console.log(`   Updated: ${loadlist.updated_at}`);

  if (loadlist.status !== 'loaded') {
    console.log(`\n⚠️ Loadlist ยังไม่ได้ยืนยันโหลด (status: ${loadlist.status})`);
    return;
  }

  console.log(`\n✅ Loadlist ยืนยันโหลดแล้ว\n`);

  // 2. ตรวจสอบสต็อกที่ Dispatch
  console.log('📊 2. ตรวจสอบสต็อกที่ Dispatch:');
  const { data: dispatchStock, error: dispatchError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('location_id', 'Dispatch')
    .gt('total_piece_qty', 0);

  if (dispatchError) {
    console.error('❌ Error:', dispatchError.message);
    return;
  }

  console.log(`   จำนวนรายการที่มีสต็อก > 0: ${dispatchStock?.length || 0}`);

  if (dispatchStock && dispatchStock.length > 0) {
    console.log('\n   รายละเอียด:');
    for (const item of dispatchStock) {
      console.log(`   - SKU: ${item.sku_id}, จำนวน: ${item.total_piece_qty} ชิ้น, จอง: ${item.reserved_piece_qty} ชิ้น`);
    }
  } else {
    console.log('   ✅ ไม่มีสต็อกหลงเหลือที่ Dispatch');
  }

  // 3. ตรวจสอบเอกสารที่ยังแสดงในแท็บ "จัดสินค้าเสร็จ"
  console.log('\n📄 3. ตรวจสอบเอกสารที่ยังแสดงในแท็บ "จัดสินค้าเสร็จ":');

  // 3.1 Picklists (เฉพาะ completed)
  const { data: picklists } = await supabase
    .from('picklists')
    .select(`
      id,
      picklist_code,
      status,
      wms_loadlist_picklists (
        loadlist_id,
        loadlists (
          loadlist_code,
          status
        )
      )
    `)
    .eq('status', 'completed');  // ✅ เฉพาะที่จัดเสร็จแล้ว

  let visiblePicklists = 0;
  if (picklists) {
    for (const pl of picklists) {
      const loadlistData = pl.wms_loadlist_picklists?.[0];
      const loadlistCode = loadlistData?.loadlists?.loadlist_code;
      const loadlistStatus = loadlistData?.loadlists?.status;

      // ข้ามถ้าอยู่ใน loadlist ที่ loaded หรือ voided แล้ว
      if (loadlistCode && (loadlistStatus === 'loaded' || loadlistStatus === 'voided')) {
        continue;
      }

      visiblePicklists++;
      console.log(`   - Picklist: ${pl.picklist_code}, Status: ${pl.status}, Loadlist: ${loadlistCode || 'ไม่มี'} (${loadlistStatus || '-'})`);
    }
  }

  // 3.2 Face Sheets (เฉพาะ completed)
  const { data: faceSheets } = await supabase
    .from('face_sheets')
    .select(`
      id,
      face_sheet_no,
      status,
      loadlist_face_sheets (
        loadlist_id,
        loadlists (
          loadlist_code,
          status
        )
      )
    `)
    .eq('status', 'completed');  // ✅ เฉพาะที่จัดเสร็จแล้ว

  let visibleFaceSheets = 0;
  if (faceSheets) {
    for (const fs of faceSheets) {
      const loadlistData = fs.loadlist_face_sheets?.[0];
      const loadlistCode = loadlistData?.loadlists?.loadlist_code;
      const loadlistStatus = loadlistData?.loadlists?.status;

      // ข้ามถ้าอยู่ใน loadlist ที่ loaded หรือ voided แล้ว
      if (loadlistCode && (loadlistStatus === 'loaded' || loadlistStatus === 'voided')) {
        continue;
      }

      visibleFaceSheets++;
      console.log(`   - Face Sheet: ${fs.face_sheet_no}, Status: ${fs.status}, Loadlist: ${loadlistCode || 'ไม่มี'} (${loadlistStatus || '-'})`);
    }
  }

  // 3.3 Bonus Face Sheets (เฉพาะ completed)
  const { data: bonusFaceSheets } = await supabase
    .from('bonus_face_sheets')
    .select(`
      id,
      face_sheet_no,
      status,
      wms_loadlist_bonus_face_sheets (
        loadlist_id,
        loadlists (
          loadlist_code,
          status
        )
      )
    `)
    .eq('status', 'completed');  // ✅ เฉพาะที่จัดเสร็จแล้ว

  let visibleBonusFaceSheets = 0;
  if (bonusFaceSheets) {
    for (const bfs of bonusFaceSheets) {
      const loadlistData = bfs.wms_loadlist_bonus_face_sheets?.[0];
      const loadlistCode = loadlistData?.loadlists?.loadlist_code;
      const loadlistStatus = loadlistData?.loadlists?.status;

      // ข้ามถ้าอยู่ใน loadlist ที่ loaded หรือ voided แล้ว
      if (loadlistCode && (loadlistStatus === 'loaded' || loadlistStatus === 'voided')) {
        continue;
      }

      visibleBonusFaceSheets++;
      console.log(`   - Bonus Face Sheet: ${bfs.face_sheet_no}, Status: ${bfs.status}, Loadlist: ${loadlistCode || 'ไม่มี'} (${loadlistStatus || '-'})`);
    }
  }

  const totalVisible = visiblePicklists + visibleFaceSheets + visibleBonusFaceSheets;
  console.log(`\n   รวมเอกสารที่ยังแสดงอยู่: ${totalVisible} รายการ`);
  console.log(`   - Picklists: ${visiblePicklists}`);
  console.log(`   - Face Sheets: ${visibleFaceSheets}`);
  console.log(`   - Bonus Face Sheets: ${visibleBonusFaceSheets}`);

  // 4. สรุป
  console.log('\n📋 สรุป:');
  if (dispatchStock && dispatchStock.length > 0) {
    console.log(`   ❌ มีสต็อกหลงเหลือที่ Dispatch: ${dispatchStock.length} รายการ`);
  } else {
    console.log('   ✅ ไม่มีสต็อกหลงเหลือที่ Dispatch');
  }

  if (totalVisible > 0) {
    console.log(`   ⚠️ มีเอกสารที่ยังแสดงในแท็บ "จัดสินค้าเสร็จ": ${totalVisible} รายการ`);
    console.log('   → เอกสารเหล่านี้อาจยังไม่ได้เข้า loadlist หรืออยู่ใน loadlist ที่ยังไม่ loaded');
  } else {
    console.log('   ✅ ไม่มีเอกสารหลงเหลือในแท็บ "จัดสินค้าเสร็จ"');
  }

  // 5. ตรวจสอบ Prep Area Inventory
  console.log('\n📦 4. ตรวจสอบสต็อกใน Preparation Areas:');
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code')
    .eq('status', 'active');

  const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];

  const { data: prepStock } = await supabase
    .from('wms_inventory_balances')
    .select('location_id, sku_id, total_piece_qty, reserved_piece_qty')
    .in('location_id', prepAreaCodes)
    .gt('total_piece_qty', 0);

  console.log(`   จำนวนรายการที่มีสต็อก > 0: ${prepStock?.length || 0}`);

  if (prepStock && prepStock.length > 0) {
    // Group by location
    const byLocation = prepStock.reduce((acc, item) => {
      if (!acc[item.location_id]) {
        acc[item.location_id] = [];
      }
      acc[item.location_id].push(item);
      return acc;
    }, {});

    for (const [location, items] of Object.entries(byLocation)) {
      const totalQty = items.reduce((sum, item) => sum + item.total_piece_qty, 0);
      const reservedQty = items.reduce((sum, item) => sum + item.reserved_piece_qty, 0);
      console.log(`   - ${location}: ${items.length} SKUs, ${totalQty} ชิ้น (จอง: ${reservedQty})`);
    }
  } else {
    console.log('   ✅ ไม่มีสต็อกใน Preparation Areas');
  }
}

checkDispatchAfterLoading()
  .then(() => {
    console.log('\n✅ ตรวจสอบเสร็จสิ้น');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
