const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMRTDPQTDStock() {
  console.log('🔍 ตรวจสอบสต็อกที่ MRTD และ PQTD\n');

  // 1. ตรวจสอบ wms_inventory_balances
  console.log('📊 1. ตรวจสอบ wms_inventory_balances:');
  const { data: balances, error: balError } = await supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      master_location!inner(location_id, location_name, location_type)
    `)
    .in('master_location.location_id', ['MRTD', 'PQTD'])
    .or('total_pack_qty.gt.0,total_piece_qty.gt.0');

  if (balError) {
    console.error('Error:', balError);
    return;
  }

  console.log(`พบ ${balances?.length || 0} รายการที่มียอดคงเหลือ > 0`);
  balances?.forEach(b => {
    const totalQty = (b.total_pack_qty || 0) + (b.total_piece_qty || 0);
    const reservedQty = (b.reserved_pack_qty || 0) + (b.reserved_piece_qty || 0);
    console.log(`  - ${b.master_location.location_id}: SKU ${b.sku_id}`);
    console.log(`    Pack: ${b.total_pack_qty} (จอง ${b.reserved_pack_qty}), Piece: ${b.total_piece_qty} (จอง ${b.reserved_piece_qty})`);
    console.log(`    Pallet: ${b.pallet_id || 'N/A'}, Lot: ${b.lot_no || 'N/A'}`);
  });

  // 2. ตรวจสอบ wms_inventory_ledger
  console.log('\n📋 2. ตรวจสอบ wms_inventory_ledger (10 รายการล่าสุด):');
  const { data: ledgers } = await supabase
    .from('wms_inventory_ledger')
    .select(`
      *,
      master_location!inner(location_id, location_name)
    `)
    .in('master_location.location_id', ['MRTD', 'PQTD'])
    .order('created_at', { ascending: false })
    .limit(10);

  ledgers?.forEach(l => {
    console.log(`  - ${l.created_at}: ${l.master_location.location_id} | ${l.transaction_type} | SKU: ${l.sku_id} | Qty: ${l.quantity_change} | Balance: ${l.balance_after}`);
  });

  // 3. ตรวจสอบ bonus_face_sheet_packages ที่ storage_location = MRTD/PQTD
  console.log('\n📦 3. ตรวจสอบ bonus_face_sheet_packages:');
  const { data: packages } = await supabase
    .from('bonus_face_sheet_packages')
    .select(`
      id,
      face_sheet_id,
      order_id,
      sku_id,
      quantity,
      storage_location,
      picked_at,
      loaded_at,
      bonus_face_sheets!inner(face_sheet_no, status)
    `)
    .in('storage_location', ['MRTD', 'PQTD']);

  console.log(`พบ ${packages?.length || 0} packages ที่ storage_location = MRTD/PQTD`);
  packages?.forEach(p => {
    console.log(`  - Package ${p.id}: BFS ${p.bonus_face_sheets.face_sheet_no} (${p.bonus_face_sheets.status})`);
    console.log(`    SKU: ${p.sku_id}, Qty: ${p.quantity}, Location: ${p.storage_location}`);
    console.log(`    Picked: ${p.picked_at || 'ยังไม่หยิบ'}, Loaded: ${p.loaded_at || 'ยังไม่โหลด'}`);
  });

  // 4. ตรวจสอบ loadlist ที่เกี่ยวข้อง
  console.log('\n🚚 4. ตรวจสอบ loadlist ที่เกี่ยวข้อง:');
  if (packages && packages.length > 0) {
    const bfsIds = [...new Set(packages.map(p => p.face_sheet_id))];
    
    const { data: loadlistMappings } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select(`
        loadlist_id,
        bonus_face_sheet_id,
        matched_package_ids,
        loadlists!inner(loadlist_code, status, bfs_confirmed_to_staging)
      `)
      .in('bonus_face_sheet_id', bfsIds);

    console.log(`พบ ${loadlistMappings?.length || 0} loadlist mappings`);
    loadlistMappings?.forEach(m => {
      const matchedCount = m.matched_package_ids?.length || 0;
      console.log(`  - Loadlist ${m.loadlists.loadlist_code} (${m.loadlists.status})`);
      console.log(`    BFS ID: ${m.bonus_face_sheet_id}, Matched packages: ${matchedCount}`);
      console.log(`    BFS confirmed to staging: ${m.loadlists.bfs_confirmed_to_staging || 'null'}`);
    });
  }

  // 5. สรุปปัญหา
  console.log('\n📝 สรุป:');
  const totalPackQty = balances?.reduce((sum, b) => sum + (b.total_pack_qty || 0), 0) || 0;
  const totalPieceQty = balances?.reduce((sum, b) => sum + (b.total_piece_qty || 0), 0) || 0;
  const reservedPackQty = balances?.reduce((sum, b) => sum + (b.reserved_pack_qty || 0), 0) || 0;
  const reservedPieceQty = balances?.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0) || 0;
  
  console.log(`- ยอดคงเหลือรวม: ${totalPackQty} แพ็ค + ${totalPieceQty} ชิ้น`);
  console.log(`- ยอดจอง: ${reservedPackQty} แพ็ค + ${reservedPieceQty} ชิ้น`);
  console.log(`- ยอดว่าง: ${totalPackQty - reservedPackQty} แพ็ค + ${totalPieceQty - reservedPieceQty} ชิ้น`);
  console.log(`- จำนวน packages ที่ยัง storage_location = MRTD/PQTD: ${packages?.length || 0}`);
  
  if ((totalPackQty > 0 || totalPieceQty > 0) && packages?.length === 0) {
    console.log('\n⚠️ ปัญหา: มียอดคงเหลือใน wms_inventory_balances แต่ไม่มี packages ที่ storage_location = MRTD/PQTD');
    console.log('   → ควรลดสต็อกออกจาก MRTD/PQTD');
  }
  
  if (packages && packages.length > 0) {
    const loadedPackages = packages.filter(p => p.loaded_at);
    const notLoadedPackages = packages.filter(p => !p.loaded_at);
    console.log(`\n- Packages ที่โหลดแล้ว: ${loadedPackages.length}`);
    console.log(`- Packages ที่ยังไม่โหลด: ${notLoadedPackages.length}`);
    
    if (loadedPackages.length > 0) {
      console.log('\n⚠️ ปัญหา: มี packages ที่โหลดแล้ว (loaded_at != null) แต่ยัง storage_location = MRTD/PQTD');
      console.log('   → ควรเคลียร์ storage_location หรือลดสต็อก');
    }
  }
}

checkMRTDPQTDStock()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
