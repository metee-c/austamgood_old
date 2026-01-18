const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyPicklistDeletion() {
  console.log('🔍 ตรวจสอบการลบ Picklists และยอดจอง...\n');

  // 1. ตรวจสอบว่า picklists ถูกลบหรือยัง
  console.log('📋 1. ตรวจสอบ Picklists ที่ถูกลบ:');
  const deletedPicklists = ['PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003'];
  
  const { data: remainingPicklists, error: picklistError } = await supabase
    .from('picklists')
    .select('id, picklist_code, status')
    .in('picklist_code', deletedPicklists);

  if (picklistError) {
    console.error('❌ Error:', picklistError);
    return;
  }

  if (remainingPicklists && remainingPicklists.length > 0) {
    console.log('⚠️  พบ Picklists ที่ยังไม่ถูกลบ:');
    remainingPicklists.forEach(pl => {
      console.log(`   - ${pl.picklist_code} (ID: ${pl.id}, Status: ${pl.status})`);
    });
  } else {
    console.log('✅ ลบ Picklists ทั้ง 3 รายการสำเร็จแล้ว\n');
  }

  // 2. ตรวจสอบ picklist_item_reservations
  console.log('📋 2. ตรวจสอบ picklist_item_reservations:');
  const { data: picklistReservations, error: plResError } = await supabase
    .from('picklist_item_reservations')
    .select(`
      reservation_id,
      reserved_piece_qty,
      reserved_pack_qty,
      picklist_items!inner (
        picklist_id,
        picklists!inner (
          picklist_code
        )
      )
    `)
    .in('picklist_items.picklists.picklist_code', deletedPicklists);

  if (plResError) {
    console.error('❌ Error:', plResError);
  } else if (picklistReservations && picklistReservations.length > 0) {
    console.log(`⚠️  พบ ${picklistReservations.length} reservations ที่ยังไม่ถูกลบ:`);
    picklistReservations.forEach(res => {
      console.log(`   - Reservation ID: ${res.reservation_id}, Piece: ${res.reserved_piece_qty}, Pack: ${res.reserved_pack_qty}`);
    });
  } else {
    console.log('✅ ไม่มี picklist_item_reservations ที่เหลืออยู่\n');
  }

  // 3. ตรวจสอบยอดจองใน wms_inventory_balances
  console.log('📋 3. ตรวจสอบยอดจองใน wms_inventory_balances:');
  const { data: balancesWithReservations, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select(`
      balance_id,
      pallet_id,
      location_id,
      sku_id,
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
  } else if (balancesWithReservations && balancesWithReservations.length > 0) {
    console.log(`⚠️  พบ ${balancesWithReservations.length} รายการที่ยังมียอดจอง:\n`);
    
    balancesWithReservations.forEach(balance => {
      const sku = balance.master_sku;
      const location = balance.master_location;
      const availablePieces = (balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0);
      const availablePacks = (balance.total_pack_qty || 0) - (balance.reserved_pack_qty || 0);
      
      console.log(`   📦 ${balance.sku_id} - ${sku?.sku_name || 'N/A'}`);
      console.log(`      Location: ${location?.location_code || balance.location_id}`);
      console.log(`      Pallet: ${balance.pallet_id || 'N/A'}`);
      console.log(`      Reserved: ${balance.reserved_piece_qty} pieces, ${balance.reserved_pack_qty} packs`);
      console.log(`      Total: ${balance.total_piece_qty} pieces, ${balance.total_pack_qty} packs`);
      console.log(`      Available: ${availablePieces} pieces, ${availablePacks} packs`);
      console.log('');
    });

    // แสดงสรุป
    const totalReservedPieces = balancesWithReservations.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0);
    const totalReservedPacks = balancesWithReservations.reduce((sum, b) => sum + (b.reserved_pack_qty || 0), 0);
    console.log(`   📊 สรุป: ${totalReservedPieces} pieces, ${totalReservedPacks} packs ยังคงถูกจอง\n`);
  } else {
    console.log('✅ ไม่มียอดจองเหลืออยู่ในระบบ (ทุกรายการเป็น 0)\n');
  }

  // 4. ตรวจสอบ face_sheet_item_reservations
  console.log('📋 4. ตรวจสอบ face_sheet_item_reservations:');
  const { data: faceSheetReservations, error: fsResError } = await supabase
    .from('face_sheet_item_reservations')
    .select('reservation_id, reserved_piece_qty, reserved_pack_qty')
    .limit(10);

  if (fsResError) {
    console.error('❌ Error:', fsResError);
  } else {
    console.log(`   พบ ${faceSheetReservations?.length || 0} face sheet reservations`);
  }

  // 5. ตรวจสอบ bonus_face_sheet_item_reservations
  console.log('📋 5. ตรวจสอบ bonus_face_sheet_item_reservations:');
  const { data: bonusReservations, error: bfsResError } = await supabase
    .from('bonus_face_sheet_item_reservations')
    .select('reservation_id, reserved_piece_qty, reserved_pack_qty')
    .limit(10);

  if (bfsResError) {
    console.error('❌ Error:', bfsResError);
  } else {
    console.log(`   พบ ${bonusReservations?.length || 0} bonus face sheet reservations\n`);
  }

  // 6. สรุปผล
  console.log('=' .repeat(60));
  console.log('📊 สรุปผลการตรวจสอบ:');
  console.log('=' .repeat(60));
  
  const allClear = 
    (!remainingPicklists || remainingPicklists.length === 0) &&
    (!picklistReservations || picklistReservations.length === 0) &&
    (!balancesWithReservations || balancesWithReservations.length === 0);

  if (allClear) {
    console.log('✅ การลบสำเร็จสมบูรณ์!');
    console.log('   - Picklists ทั้ง 3 รายการถูกลบแล้ว');
    console.log('   - ไม่มี picklist_item_reservations เหลืออยู่');
    console.log('   - ยอดจองทั้งหมดเป็น 0');
  } else {
    console.log('⚠️  พบปัญหา:');
    if (remainingPicklists && remainingPicklists.length > 0) {
      console.log(`   - ยังมี ${remainingPicklists.length} picklists ที่ไม่ถูกลบ`);
    }
    if (picklistReservations && picklistReservations.length > 0) {
      console.log(`   - ยังมี ${picklistReservations.length} picklist reservations เหลืออยู่`);
    }
    if (balancesWithReservations && balancesWithReservations.length > 0) {
      console.log(`   - ยังมี ${balancesWithReservations.length} รายการที่มียอดจอง`);
    }
  }
  console.log('=' .repeat(60));
}

verifyPicklistDeletion().catch(console.error);
