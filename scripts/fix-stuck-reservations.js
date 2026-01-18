const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixStuckReservations() {
  console.log('🔧 แก้ไข Reservations ที่ค้างอยู่...\n');

  // 1. หา reservations ที่ status = 'reserved' แต่ picklist_item status = 'picked'
  const { data: stuckReservations, error: fetchError } = await supabase
    .from('picklist_item_reservations')
    .select(`
      reservation_id,
      balance_id,
      status,
      reserved_piece_qty,
      reserved_pack_qty,
      picklist_item_id,
      picklist_items!inner (
        id,
        status,
        sku_id,
        picklist_id,
        picklists!inner (
          id,
          picklist_code,
          status
        )
      )
    `)
    .eq('status', 'reserved')
    .eq('picklist_items.status', 'picked');

  if (fetchError) {
    console.error('❌ Error:', fetchError);
    return;
  }

  console.log(`📋 พบ ${stuckReservations.length} reservations ที่ค้างอยู่:\n`);

  if (stuckReservations.length === 0) {
    console.log('✅ ไม่มี reservations ที่ค้างอยู่');
    return;
  }

  // แสดงรายละเอียด
  stuckReservations.forEach(res => {
    const item = res.picklist_items;
    const picklist = item?.picklists;
    console.log(`   - Reservation ${res.reservation_id}:`);
    console.log(`     Picklist: ${picklist?.picklist_code} (${picklist?.status})`);
    console.log(`     Item: ${item?.sku_id} (${item?.status})`);
    console.log(`     Qty: ${res.reserved_piece_qty} pieces, ${res.reserved_pack_qty} packs`);
    console.log('');
  });

  // 2. ถามยืนยันก่อนแก้ไข
  console.log('\n⚠️  จะดำเนินการ:');
  console.log('   1. Update reservation status จาก "reserved" → "picked"');
  console.log('   2. ลดยอดจองใน wms_inventory_balances');
  console.log('\nกด Ctrl+C เพื่อยกเลิก หรือรอ 5 วินาทีเพื่อดำเนินการต่อ...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('🔧 เริ่มแก้ไข...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const res of stuckReservations) {
    try {
      // Update reservation status
      const { error: updateResError } = await supabase
        .from('picklist_item_reservations')
        .update({
          status: 'picked',
          picked_at: new Date().toISOString()
        })
        .eq('reservation_id', res.reservation_id);

      if (updateResError) {
        console.error(`❌ Error updating reservation ${res.reservation_id}:`, updateResError);
        errorCount++;
        continue;
      }

      // ลดยอดจองใน balance
      const { data: currentBalance, error: fetchBalanceError } = await supabase
        .from('wms_inventory_balances')
        .select('reserved_piece_qty, reserved_pack_qty')
        .eq('balance_id', res.balance_id)
        .single();

      if (fetchBalanceError) {
        console.error(`❌ Error fetching balance ${res.balance_id}:`, fetchBalanceError);
        errorCount++;
        continue;
      }

      const newReservedPieces = Math.max(0, (currentBalance.reserved_piece_qty || 0) - (res.reserved_piece_qty || 0));
      const newReservedPacks = Math.max(0, (currentBalance.reserved_pack_qty || 0) - (res.reserved_pack_qty || 0));

      const { error: updateBalanceError } = await supabase
        .from('wms_inventory_balances')
        .update({
          reserved_piece_qty: newReservedPieces,
          reserved_pack_qty: newReservedPacks
        })
        .eq('balance_id', res.balance_id);

      if (updateBalanceError) {
        console.error(`❌ Error updating balance ${res.balance_id}:`, updateBalanceError);
        errorCount++;
        continue;
      }

      const item = res.picklist_items;
      const picklist = item?.picklists;
      console.log(`✅ Fixed reservation ${res.reservation_id} (${picklist?.picklist_code})`);
      successCount++;

    } catch (error) {
      console.error(`❌ Error processing reservation ${res.reservation_id}:`, error);
      errorCount++;
    }
  }

  // 3. สรุปผล
  console.log('\n' + '='.repeat(70));
  console.log('📊 สรุปผลการแก้ไข');
  console.log('='.repeat(70));
  console.log(`✅ สำเร็จ: ${successCount} reservations`);
  console.log(`❌ ล้มเหลว: ${errorCount} reservations`);

  // 4. ตรวจสอบยอดจองหลังแก้ไข
  console.log('\n🔍 ตรวจสอบยอดจองหลังแก้ไข...\n');

  const { data: remainingBalances, error: checkError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, reserved_piece_qty, reserved_pack_qty')
    .or('reserved_piece_qty.gt.0,reserved_pack_qty.gt.0');

  if (checkError) {
    console.error('❌ Error:', checkError);
  } else {
    const totalReserved = remainingBalances.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0);
    console.log(`📊 ยอดจองคงเหลือ: ${totalReserved} pieces จาก ${remainingBalances.length} balance records`);
    
    if (totalReserved === 0) {
      console.log('✅ ยอดจองทั้งหมดถูกปล่อยแล้ว!');
    } else {
      console.log('\n⚠️  ยังมียอดจองคงเหลือ:');
      remainingBalances.forEach(b => {
        console.log(`   - ${b.sku_id}: ${b.reserved_piece_qty} pieces, ${b.reserved_pack_qty} packs`);
      });
    }
  }

  console.log('\n' + '='.repeat(70));
}

fixStuckReservations().catch(console.error);
