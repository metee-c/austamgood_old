const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function investigateRemainingReservations() {
  console.log('🔍 ตรวจสอบยอดจอง 300 pieces ที่เหลืออยู่...\n');

  // 1. ดึงรายการที่มียอดจอง
  const { data: balances, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select(`
      balance_id,
      location_id,
      sku_id,
      pallet_id,
      reserved_piece_qty,
      reserved_pack_qty,
      total_piece_qty,
      total_pack_qty,
      master_sku (
        sku_id,
        sku_name
      ),
      master_location (
        location_code
      )
    `)
    .or('reserved_piece_qty.gt.0,reserved_pack_qty.gt.0')
    .order('reserved_piece_qty', { ascending: false });

  if (balanceError) {
    console.error('❌ Error:', balanceError);
    return;
  }

  console.log(`📊 พบ ${balances.length} รายการที่มียอดจอง:\n`);

  // 2. สำหรับแต่ละ balance ให้ตรวจสอบว่ามี reservations อะไรบ้าง
  for (const balance of balances) {
    const sku = balance.master_sku;
    const location = balance.master_location;

    console.log('='.repeat(70));
    console.log(`📦 ${balance.sku_id} - ${sku?.sku_name || 'N/A'}`);
    console.log(`   Location: ${location?.location_code || balance.location_id}`);
    console.log(`   Pallet: ${balance.pallet_id || 'N/A'}`);
    console.log(`   Reserved: ${balance.reserved_piece_qty} pieces, ${balance.reserved_pack_qty} packs`);
    console.log(`   Total: ${balance.total_piece_qty} pieces, ${balance.total_pack_qty} packs`);

    // ตรวจสอบ picklist_item_reservations
    const { data: picklistReservations, error: plError } = await supabase
      .from('picklist_item_reservations')
      .select(`
        reservation_id,
        status,
        reserved_piece_qty,
        reserved_pack_qty,
        picklist_item_id,
        picklist_items!inner (
          id,
          picklist_id,
          sku_id,
          status,
          picklists!inner (
            id,
            picklist_code,
            status
          )
        )
      `)
      .eq('balance_id', balance.balance_id);

    if (plError) {
      console.error('   ❌ Error fetching picklist reservations:', plError);
    } else if (picklistReservations && picklistReservations.length > 0) {
      console.log(`\n   🔒 Picklist Reservations (${picklistReservations.length} รายการ):`);
      picklistReservations.forEach(res => {
        const item = res.picklist_items;
        const picklist = item?.picklists;
        console.log(`      - Reservation ${res.reservation_id}:`);
        console.log(`        Status: ${res.status}`);
        console.log(`        Qty: ${res.reserved_piece_qty} pieces, ${res.reserved_pack_qty} packs`);
        console.log(`        Picklist: ${picklist?.picklist_code} (${picklist?.status})`);
        console.log(`        Item Status: ${item?.status}`);
      });
    }

    // ตรวจสอบ face_sheet_item_reservations
    const { data: faceSheetReservations, error: fsError } = await supabase
      .from('face_sheet_item_reservations')
      .select(`
        reservation_id,
        status,
        reserved_piece_qty,
        reserved_pack_qty,
        face_sheet_item_id,
        face_sheet_items!inner (
          id,
          face_sheet_id,
          sku_id,
          status,
          face_sheets!inner (
            id,
            face_sheet_code,
            status
          )
        )
      `)
      .eq('balance_id', balance.balance_id);

    if (fsError) {
      console.error('   ❌ Error fetching face sheet reservations:', fsError);
    } else if (faceSheetReservations && faceSheetReservations.length > 0) {
      console.log(`\n   🔒 Face Sheet Reservations (${faceSheetReservations.length} รายการ):`);
      faceSheetReservations.forEach(res => {
        const item = res.face_sheet_items;
        const faceSheet = item?.face_sheets;
        console.log(`      - Reservation ${res.reservation_id}:`);
        console.log(`        Status: ${res.status}`);
        console.log(`        Qty: ${res.reserved_piece_qty} pieces, ${res.reserved_pack_qty} packs`);
        console.log(`        Face Sheet: ${faceSheet?.face_sheet_code} (${faceSheet?.status})`);
        console.log(`        Item Status: ${item?.status}`);
      });
    }

    // ตรวจสอบ bonus_face_sheet_item_reservations
    const { data: bonusReservations, error: bfsError } = await supabase
      .from('bonus_face_sheet_item_reservations')
      .select(`
        reservation_id,
        status,
        reserved_piece_qty,
        reserved_pack_qty,
        bonus_face_sheet_item_id,
        bonus_face_sheet_items!inner (
          id,
          bonus_face_sheet_id,
          sku_id,
          status,
          bonus_face_sheets!inner (
            id,
            bonus_face_sheet_code,
            status
          )
        )
      `)
      .eq('balance_id', balance.balance_id);

    if (bfsError) {
      console.error('   ❌ Error fetching bonus face sheet reservations:', bfsError);
    } else if (bonusReservations && bonusReservations.length > 0) {
      console.log(`\n   🔒 Bonus Face Sheet Reservations (${bonusReservations.length} รายการ):`);
      bonusReservations.forEach(res => {
        const item = res.bonus_face_sheet_items;
        const bonusFaceSheet = item?.bonus_face_sheets;
        console.log(`      - Reservation ${res.reservation_id}:`);
        console.log(`        Status: ${res.status}`);
        console.log(`        Qty: ${res.reserved_piece_qty} pieces, ${res.reserved_pack_qty} packs`);
        console.log(`        Bonus Face Sheet: ${bonusFaceSheet?.bonus_face_sheet_code} (${bonusFaceSheet?.status})`);
        console.log(`        Item Status: ${item?.status}`);
      });
    }

    // ถ้าไม่มี reservation ใดๆ เลย
    const totalReservations = (picklistReservations?.length || 0) + 
                             (faceSheetReservations?.length || 0) + 
                             (bonusReservations?.length || 0);
    
    if (totalReservations === 0) {
      console.log('\n   ⚠️ ไม่พบ reservation ใดๆ แต่ balance มียอดจอง!');
      console.log('   🐛 นี่คือ BUG - ยอดจองใน balance ไม่ตรงกับ reservation tables');
    }

    console.log('');
  }

  // 3. สรุป
  console.log('\n' + '='.repeat(70));
  console.log('📊 สรุป');
  console.log('='.repeat(70));

  const totalReservedPieces = balances.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0);
  const totalReservedPacks = balances.reduce((sum, b) => sum + (b.reserved_pack_qty || 0), 0);

  console.log(`\nยอดจองทั้งหมดในระบบ: ${totalReservedPieces} pieces, ${totalReservedPacks} packs`);
  console.log(`จำนวน balance records ที่มียอดจอง: ${balances.length} รายการ`);
}

investigateRemainingReservations().catch(console.error);
