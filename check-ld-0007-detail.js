// ตรวจสอบ LD-20260120-0007 และ BFS ที่เกี่ยวข้อง
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLD0007() {
  console.log('📊 ตรวจสอบ LD-20260120-0007');
  console.log('='.repeat(100));

  // ========================================
  // 1. ดึงข้อมูล Loadlist
  // ========================================
  const { data: loadlist, error: llError } = await supabase
    .from('loadlists')
    .select(`
      id, loadlist_code, status, created_at,
      wms_loadlist_bonus_face_sheets(
        bonus_face_sheet_id,
        loaded_at,
        bonus_face_sheets(
          id, face_sheet_no, status
        )
      ),
      wms_loadlist_picklists(
        picklist_id,
        picklists(
          id, picklist_code, status
        )
      )
    `)
    .eq('loadlist_code', 'LD-20260120-0007')
    .single();

  if (llError) {
    console.log('❌ Error:', llError.message);
    return;
  }

  console.log('\n📋 Loadlist Info:');
  console.log(`   Code: ${loadlist.loadlist_code}`);
  console.log(`   Status: ${loadlist.status}`);
  console.log(`   Created: ${loadlist.created_at}`);

  // BFS links
  const bfsLinks = loadlist.wms_loadlist_bonus_face_sheets || [];
  console.log(`\n🎁 BFS Links: ${bfsLinks.length}`);
  bfsLinks.forEach(link => {
    const bfs = link.bonus_face_sheets;
    console.log(`   - ${bfs?.face_sheet_no} (status: ${bfs?.status}, loaded_at: ${link.loaded_at || 'not loaded'})`);
  });

  // Picklist links
  const plLinks = loadlist.wms_loadlist_picklists || [];
  console.log(`\n📦 Picklist Links: ${plLinks.length}`);
  plLinks.forEach(link => {
    const pl = link.picklists;
    console.log(`   - ${pl?.picklist_code} (status: ${pl?.status})`);
  });

  // ========================================
  // 2. ดึง BFS Items ที่เกี่ยวข้อง
  // ========================================
  const bfsIds = bfsLinks.map(l => l.bonus_face_sheet_id);

  if (bfsIds.length > 0) {
    const { data: bfsItems, error: bfsItemError } = await supabase
      .from('bonus_face_sheet_items')
      .select('id, sku_id, quantity, quantity_picked, status, picked_at, face_sheet_id')
      .in('face_sheet_id', bfsIds);

    if (!bfsItemError && bfsItems) {
      console.log('\n' + '='.repeat(100));
      console.log('📦 BFS Items:');
      console.log('-'.repeat(80));
      console.log(
        'BFS ID'.padEnd(10) +
        'SKU'.padEnd(30) +
        'Qty'.padEnd(8) +
        'Picked'.padEnd(8) +
        'Status'.padEnd(12) +
        'Picked At'
      );
      console.log('-'.repeat(80));

      bfsItems.forEach(item => {
        console.log(
          String(item.face_sheet_id).padEnd(10) +
          String(item.sku_id).substring(0, 28).padEnd(30) +
          String(item.quantity || 0).padEnd(8) +
          String(item.quantity_picked || 0).padEnd(8) +
          String(item.status).padEnd(12) +
          String(item.picked_at?.substring(0, 19) || '-')
        );
      });

      // สรุป
      const totalQty = bfsItems.reduce((sum, i) => sum + (parseFloat(i.quantity_picked) || 0), 0);
      const pickedCount = bfsItems.filter(i => i.status === 'picked').length;
      console.log('-'.repeat(80));
      console.log(`สรุป: ${pickedCount}/${bfsItems.length} items picked, total picked qty: ${totalQty}`);
    }
  }

  // ========================================
  // 3. ตรวจสอบ Ledger entries สำหรับ BFS เหล่านี้
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📝 Ledger entries ที่เกี่ยวกับ BFS เหล่านี้ (MRTD/PQTD):');
  console.log('-'.repeat(100));

  // BFS-20260119-002 และ BFS-20260113-003
  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('sku_id, location_id, piece_qty, direction, reference_doc_type, reference_no, created_at')
    .in('location_id', ['MRTD', 'PQTD'])
    .or('reference_no.ilike.%BFS-20260119-002%,reference_no.ilike.%BFS-20260113-003%')
    .order('created_at', { ascending: false });

  if (ledgerError) {
    console.log('❌ Error:', ledgerError.message);
  } else if (ledgerEntries && ledgerEntries.length > 0) {
    console.log(
      'Location'.padEnd(8) +
      'SKU'.padEnd(28) +
      'Dir'.padEnd(5) +
      'Qty'.padEnd(8) +
      'Doc Type'.padEnd(30) +
      'Ref No'
    );
    console.log('-'.repeat(100));

    ledgerEntries.forEach(entry => {
      console.log(
        String(entry.location_id).padEnd(8) +
        String(entry.sku_id).substring(0, 26).padEnd(28) +
        String(entry.direction).padEnd(5) +
        String(entry.piece_qty || 0).padEnd(8) +
        String(entry.reference_doc_type || '-').substring(0, 28).padEnd(30) +
        String(entry.reference_no || '-').substring(0, 40)
      );
    });

    // สรุป IN vs OUT
    let totalIn = 0, totalOut = 0;
    ledgerEntries.forEach(e => {
      if (e.direction === 'in') totalIn += parseFloat(e.piece_qty) || 0;
      else if (e.direction === 'out') totalOut += parseFloat(e.piece_qty) || 0;
    });
    console.log('-'.repeat(100));
    console.log(`สรุป: IN=${totalIn}, OUT=${totalOut}, Net=${totalIn - totalOut}`);
  } else {
    console.log('ไม่พบ ledger entries สำหรับ BFS-20260119-002 และ BFS-20260113-003');
  }

  // ========================================
  // 4. ตรวจสอบ Balance ที่ MRTD/PQTD สำหรับ SKUs ใน BFS
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('💰 Balance ที่ MRTD/PQTD สำหรับ SKUs ใน loadlist นี้:');

  // รวบรวม SKUs จาก BFS items
  if (bfsIds.length > 0) {
    const { data: bfsItems } = await supabase
      .from('bonus_face_sheet_items')
      .select('sku_id')
      .in('face_sheet_id', bfsIds);

    const skuIds = [...new Set((bfsItems || []).map(i => i.sku_id))];

    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select('sku_id, location_id, total_piece_qty, reserved_piece_qty')
      .in('location_id', ['MRTD', 'PQTD'])
      .in('sku_id', skuIds);

    if (!balanceError && balances) {
      console.log('-'.repeat(80));
      console.log(
        'Location'.padEnd(10) +
        'SKU'.padEnd(30) +
        'Total Qty'.padEnd(12) +
        'Reserved'
      );
      console.log('-'.repeat(80));

      const hasBalance = balances.filter(b => (parseFloat(b.total_piece_qty) || 0) > 0);
      if (hasBalance.length > 0) {
        hasBalance.forEach(b => {
          console.log(
            String(b.location_id).padEnd(10) +
            String(b.sku_id).substring(0, 28).padEnd(30) +
            String(b.total_piece_qty).padEnd(12) +
            String(b.reserved_piece_qty || 0)
          );
        });
      } else {
        console.log('⚠️ ไม่มี balance > 0 ที่ MRTD/PQTD สำหรับ SKUs ใน loadlist นี้!');
      }

      const allZero = balances.filter(b => (parseFloat(b.total_piece_qty) || 0) === 0);
      console.log(`\n📊 Records ที่ = 0: ${allZero.length} รายการ`);
    }
  }

  console.log('\n' + '='.repeat(100));
}

checkLD0007().catch(console.error);
