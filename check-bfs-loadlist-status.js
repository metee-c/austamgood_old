// ตรวจสอบ BFS และ Loadlist status
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBFSLoadlistStatus() {
  console.log('📊 ตรวจสอบ BFS และ Loadlist Status');
  console.log('='.repeat(100));

  // ========================================
  // 1. ดึง Loadlists ที่มี BFS ล่าสุด
  // ========================================
  const { data: loadlists, error: loadlistError } = await supabase
    .from('loadlists')
    .select(`
      id, loadlist_code, status, created_at, updated_at,
      wms_loadlist_bonus_face_sheets(
        bonus_face_sheet_id,
        loaded_at,
        bonus_face_sheets(
          id, face_sheet_no, status, created_date
        )
      )
    `)
    .not('wms_loadlist_bonus_face_sheets', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (loadlistError) {
    console.log('❌ Error loading loadlists:', loadlistError.message);
    return;
  }

  console.log(`\n📋 Loadlists ล่าสุดที่มี BFS (10 รายการ):`);
  console.log('-'.repeat(100));
  console.log(
    'Loadlist'.padEnd(20) +
    'Status'.padEnd(12) +
    'Created'.padEnd(25) +
    'BFS Count'.padEnd(12) +
    'BFS Nos'
  );
  console.log('-'.repeat(100));

  (loadlists || []).forEach(ll => {
    const bfsLinks = ll.wms_loadlist_bonus_face_sheets || [];
    const bfsNos = bfsLinks.map(link => link.bonus_face_sheets?.face_sheet_no).filter(Boolean);
    console.log(
      String(ll.loadlist_code).padEnd(20) +
      String(ll.status).padEnd(12) +
      String(ll.created_at?.substring(0, 19)).padEnd(25) +
      String(bfsLinks.length).padEnd(12) +
      bfsNos.join(', ')
    );
  });

  // ========================================
  // 2. ตรวจสอบ BFS items ที่ picked
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📦 BFS Items ที่ picked ล่าสุด:');
  console.log('-'.repeat(100));

  const { data: bfsItems, error: bfsItemError } = await supabase
    .from('bonus_face_sheet_items')
    .select(`
      id, sku_id, quantity, quantity_picked, status, picked_at, storage_location,
      bonus_face_sheets!inner(id, face_sheet_no, status)
    `)
    .eq('status', 'picked')
    .order('picked_at', { ascending: false })
    .limit(20);

  if (bfsItemError) {
    console.log('❌ Error loading BFS items:', bfsItemError.message);
  } else if (bfsItems && bfsItems.length > 0) {
    console.log(
      'BFS No'.padEnd(22) +
      'SKU'.padEnd(20) +
      'Qty'.padEnd(8) +
      'Picked'.padEnd(8) +
      'Status'.padEnd(12) +
      'Picked At'.padEnd(25) +
      'Storage'
    );
    console.log('-'.repeat(100));

    bfsItems.forEach(item => {
      console.log(
        String(item.bonus_face_sheets?.face_sheet_no || '-').padEnd(22) +
        String(item.sku_id).substring(0, 18).padEnd(20) +
        String(item.quantity || 0).padEnd(8) +
        String(item.quantity_picked || 0).padEnd(8) +
        String(item.status).padEnd(12) +
        String(item.picked_at?.substring(0, 19) || '-').padEnd(25) +
        String(item.storage_location || '-')
      );
    });
  } else {
    console.log('ไม่มี BFS items ที่ picked');
  }

  // ========================================
  // 3. ตรวจสอบ ledger entries ที่เกี่ยวกับ MRTD/PQTD ทั้งหมด (ไม่จำกัดวันที่)
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('📝 Ledger entries ที่ MRTD/PQTD (ทุกวัน - 20 รายการล่าสุด):');
  console.log('-'.repeat(100));

  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('sku_id, location_id, piece_qty, direction, reference_doc_type, reference_no, created_at')
    .in('location_id', ['MRTD', 'PQTD'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (ledgerError) {
    console.log('❌ Error loading ledger:', ledgerError.message);
  } else if (ledgerEntries && ledgerEntries.length > 0) {
    console.log(
      'Location'.padEnd(10) +
      'SKU'.padEnd(20) +
      'Dir'.padEnd(6) +
      'Qty'.padEnd(10) +
      'Doc Type'.padEnd(15) +
      'Ref No'.padEnd(20) +
      'Created'
    );
    console.log('-'.repeat(100));

    ledgerEntries.forEach(entry => {
      console.log(
        String(entry.location_id).padEnd(10) +
        String(entry.sku_id).substring(0, 18).padEnd(20) +
        String(entry.direction).padEnd(6) +
        String(entry.piece_qty || 0).padEnd(10) +
        String(entry.reference_doc_type || '-').padEnd(15) +
        String(entry.reference_no || '-').substring(0, 18).padEnd(20) +
        String(entry.created_at?.substring(0, 19) || '-')
      );
    });
  } else {
    console.log('ไม่มี Ledger entries ที่ MRTD/PQTD เลย');
  }

  // ========================================
  // 4. ตรวจสอบ Inventory Balances ที่ MRTD/PQTD
  // ========================================
  console.log('\n' + '='.repeat(100));
  console.log('💰 Inventory Balances ที่ MRTD/PQTD:');
  console.log('-'.repeat(100));

  const { data: balances, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, location_id, total_piece_qty, reserved_piece_qty, created_at')
    .in('location_id', ['MRTD', 'PQTD'])
    .order('location_id')
    .limit(50);

  if (balanceError) {
    console.log('❌ Error loading balances:', balanceError.message);
  } else if (balances && balances.length > 0) {
    console.log(
      'Location'.padEnd(10) +
      'SKU'.padEnd(25) +
      'Total Qty'.padEnd(12) +
      'Reserved'.padEnd(12) +
      'Created'
    );
    console.log('-'.repeat(100));

    balances.forEach(b => {
      console.log(
        String(b.location_id).padEnd(10) +
        String(b.sku_id).substring(0, 23).padEnd(25) +
        String(b.total_piece_qty || 0).padEnd(12) +
        String(b.reserved_piece_qty || 0).padEnd(12) +
        String(b.created_at?.substring(0, 19) || '-')
      );
    });
  } else {
    console.log('ไม่มี Inventory Balances ที่ MRTD/PQTD');
  }

  console.log('\n' + '='.repeat(100));
}

checkBFSLoadlistStatus().catch(console.error);
