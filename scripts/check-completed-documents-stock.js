/**
 * ตรวจสอบว่าสต็อกของเอกสารที่ status = completed ยังอยู่ที่ Dispatch หรือไม่
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCompletedDocumentsStock() {
  console.log('🔍 ตรวจสอบสต็อกของเอกสารที่ status = completed...\n');

  const documentsToCheck = [
    'PL-20260113-007',
    'BFS-20260113-005',
    'BFS-20260108-001',
    'BFS-20260107-006',
    'BFS-20260107-005',
    'BFS-20260107-004',
    'BFS-20260107-003',
    'BFS-20260107-002'
  ];

  for (const docCode of documentsToCheck) {
    console.log(`\n📄 ${docCode}:`);

    let items = [];
    let docType = '';

    // ตรวจสอบว่าเป็น Picklist หรือ Bonus Face Sheet
    if (docCode.startsWith('PL-')) {
      docType = 'Picklist';
      const { data: picklist } = await supabase
        .from('picklists')
        .select(`
          id,
          picklist_code,
          status,
          picklist_items (
            sku_id,
            quantity_to_pick
          )
        `)
        .eq('picklist_code', docCode)
        .single();

      if (picklist) {
        console.log(`   Status: ${picklist.status}`);
        items = picklist.picklist_items || [];
      }
    } else if (docCode.startsWith('BFS-')) {
      docType = 'Bonus Face Sheet';
      const { data: bfs } = await supabase
        .from('bonus_face_sheets')
        .select(`
          id,
          face_sheet_no,
          status,
          bonus_face_sheet_items (
            sku_id,
            quantity_picked,
            quantity_to_pick
          )
        `)
        .eq('face_sheet_no', docCode)
        .single();

      if (bfs) {
        console.log(`   Status: ${bfs.status}`);
        items = bfs.bonus_face_sheet_items || [];
      }
    }

    if (items.length === 0) {
      console.log('   ⚠️ ไม่พบรายการสินค้า');
      continue;
    }

    console.log(`   จำนวนรายการ: ${items.length}`);

    // ตรวจสอบสต็อกที่ Dispatch สำหรับแต่ละ SKU
    let totalAtDispatch = 0;
    const skuDetails = [];

    for (const item of items) {
      const qty = item.quantity_picked || item.quantity_to_pick || 0;
      
      const { data: dispatchStock } = await supabase
        .from('wms_inventory_balances')
        .select('total_piece_qty')
        .eq('location_id', 'Dispatch')
        .eq('sku_id', item.sku_id)
        .gt('total_piece_qty', 0);

      const availableQty = (dispatchStock || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
      
      if (availableQty > 0) {
        totalAtDispatch += availableQty;
        skuDetails.push({
          sku_id: item.sku_id,
          required: qty,
          available: availableQty
        });
      }
    }

    if (totalAtDispatch > 0) {
      console.log(`   ✅ มีสต็อกที่ Dispatch: ${totalAtDispatch} ชิ้น`);
      console.log('   รายละเอียด:');
      for (const detail of skuDetails) {
        console.log(`      - ${detail.sku_id}: ต้องการ ${detail.required}, มีอยู่ ${detail.available}`);
      }
    } else {
      console.log('   ❌ ไม่มีสต็อกที่ Dispatch (อาจถูกย้ายไปแล้ว)');
    }
  }

  console.log('\n\n📊 สรุป:');
  console.log('   เอกสารที่ status = completed แต่ยังไม่ได้เข้า loadlist:');
  console.log('   → สต็อกยังอยู่ที่ Dispatch');
  console.log('   → จะย้ายไป Delivery-In-Progress เมื่อ:');
  console.log('      1. เพิ่มเอกสารเข้า loadlist');
  console.log('      2. ยืนยันโหลด loadlist');
}

checkCompletedDocumentsStock()
  .then(() => {
    console.log('\n✅ ตรวจสอบเสร็จสิ้น');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
