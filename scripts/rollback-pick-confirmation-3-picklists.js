const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function rollbackPickConfirmation() {
  console.log('🔄 Rollback การยืนยันหยิบ 3 ใบ (PL-312, PL-313, PL-314)...\n');

  const picklistIds = [312, 313, 314];

  // 1. ตรวจสอบสถานะปัจจุบัน
  console.log('📋 1. ตรวจสอบสถานะปัจจุบัน:');
  const { data: picklists, error: fetchError } = await supabase
    .from('picklists')
    .select('id, picklist_code, status, picking_completed_at')
    .in('id', picklistIds)
    .order('id');

  if (fetchError) {
    console.error('❌ Error:', fetchError);
    return;
  }

  picklists.forEach(pl => {
    console.log(`   - ${pl.picklist_code}: ${pl.status} (completed at: ${pl.picking_completed_at || 'N/A'})`);
  });

  console.log('\n⚠️  จะดำเนินการ:');
  console.log('   1. เปลี่ยนสถานะ picklists จาก "completed" → "pending"');
  console.log('   2. ล้าง picking_completed_at');
  console.log('   3. เปลี่ยนสถานะ picklist_items จาก "picked" → "pending"');
  console.log('   4. ล้าง quantity_picked และ picked_at');
  console.log('   5. เปลี่ยนสถานะ reservations จาก "picked" → "reserved"');
  console.log('   6. คืนยอดจองใน wms_inventory_balances');
  console.log('   7. ลบ ledger entries ที่เกิดจากการหยิบ (transaction_type = "pick")');
  console.log('\nกด Ctrl+C เพื่อยกเลิก หรือรอ 5 วินาทีเพื่อดำเนินการต่อ...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('🔄 เริ่ม Rollback...\n');

  for (const picklistId of picklistIds) {
    const picklist = picklists.find(p => p.id === picklistId);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📦 Processing ${picklist.picklist_code} (ID: ${picklistId})`);
    console.log('='.repeat(70));

    try {
      // 1. ดึง picklist items
      const { data: items, error: itemsError } = await supabase
        .from('picklist_items')
        .select('id, sku_id, quantity_to_pick, quantity_picked, status')
        .eq('picklist_id', picklistId);

      if (itemsError) {
        console.error('❌ Error fetching items:', itemsError);
        continue;
      }

      console.log(`\n📝 พบ ${items.length} items`);

      // 2. ดึง reservations
      const { data: reservations, error: resError } = await supabase
        .from('picklist_item_reservations')
        .select(`
          reservation_id,
          balance_id,
          status,
          reserved_piece_qty,
          reserved_pack_qty,
          picklist_item_id
        `)
        .in('picklist_item_id', items.map(i => i.id));

      if (resError) {
        console.error('❌ Error fetching reservations:', resError);
        continue;
      }

      console.log(`🔒 พบ ${reservations.length} reservations`);

      // 3. Update picklist items: picked → pending
      const { error: updateItemsError } = await supabase
        .from('picklist_items')
        .update({
          status: 'pending',
          quantity_picked: null,
          picked_at: null,
          picked_by_employee_id: null
        })
        .eq('picklist_id', picklistId);

      if (updateItemsError) {
        console.error('❌ Error updating items:', updateItemsError);
        continue;
      }

      console.log('✅ Updated picklist items → pending');

      // 4. Update reservations: picked → reserved และคืนยอดจอง
      for (const res of reservations) {
        // Update reservation status
        const { error: updateResError } = await supabase
          .from('picklist_item_reservations')
          .update({
            status: 'reserved',
            picked_at: null
          })
          .eq('reservation_id', res.reservation_id);

        if (updateResError) {
          console.error(`❌ Error updating reservation ${res.reservation_id}:`, updateResError);
          continue;
        }

        // คืนยอดจองใน balance
        const { data: currentBalance, error: fetchBalanceError } = await supabase
          .from('wms_inventory_balances')
          .select('reserved_piece_qty, reserved_pack_qty')
          .eq('balance_id', res.balance_id)
          .single();

        if (fetchBalanceError) {
          console.error(`❌ Error fetching balance ${res.balance_id}:`, fetchBalanceError);
          continue;
        }

        const newReservedPieces = (currentBalance.reserved_piece_qty || 0) + (res.reserved_piece_qty || 0);
        const newReservedPacks = (currentBalance.reserved_pack_qty || 0) + (res.reserved_pack_qty || 0);

        const { error: updateBalanceError } = await supabase
          .from('wms_inventory_balances')
          .update({
            reserved_piece_qty: newReservedPieces,
            reserved_pack_qty: newReservedPacks
          })
          .eq('balance_id', res.balance_id);

        if (updateBalanceError) {
          console.error(`❌ Error updating balance ${res.balance_id}:`, updateBalanceError);
          continue;
        }
      }

      console.log('✅ Updated reservations → reserved และคืนยอดจอง');

      // 5. ลบ ledger entries (transaction_type = 'pick')
      const { error: deleteLedgerError } = await supabase
        .from('wms_inventory_ledger')
        .delete()
        .eq('document_type', 'picklist')
        .eq('document_id', picklistId)
        .eq('transaction_type', 'pick');

      if (deleteLedgerError) {
        console.error('❌ Error deleting ledger entries:', deleteLedgerError);
      } else {
        console.log('✅ Deleted pick ledger entries');
      }

      // 6. Update picklist status: completed → pending
      const { error: updatePicklistError } = await supabase
        .from('picklists')
        .update({
          status: 'pending',
          picking_completed_at: null,
          picking_started_at: null
        })
        .eq('id', picklistId);

      if (updatePicklistError) {
        console.error('❌ Error updating picklist:', updatePicklistError);
        continue;
      }

      console.log('✅ Updated picklist → pending');
      console.log(`\n✅ Rollback ${picklist.picklist_code} สำเร็จ!`);

    } catch (error) {
      console.error(`❌ Error processing picklist ${picklistId}:`, error);
    }
  }

  // 7. ตรวจสอบผลลัพธ์
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 ตรวจสอบผลลัพธ์');
  console.log('='.repeat(70));

  const { data: updatedPicklists, error: checkError } = await supabase
    .from('picklists')
    .select('id, picklist_code, status, picking_completed_at')
    .in('id', picklistIds)
    .order('id');

  if (checkError) {
    console.error('❌ Error:', checkError);
  } else {
    console.log('\n📋 สถานะ Picklists หลัง Rollback:');
    updatedPicklists.forEach(pl => {
      const icon = pl.status === 'pending' ? '✅' : '❌';
      console.log(`   ${icon} ${pl.picklist_code}: ${pl.status}`);
    });
  }

  // ตรวจสอบยอดจอง
  const { data: balances, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, reserved_piece_qty, reserved_pack_qty')
    .or('reserved_piece_qty.gt.0,reserved_pack_qty.gt.0');

  if (balanceError) {
    console.error('❌ Error:', balanceError);
  } else {
    const totalReserved = balances.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0);
    console.log(`\n🔒 ยอดจองในระบบ: ${totalReserved} pieces จาก ${balances.length} balance records`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Rollback เสร็จสมบูรณ์!');
  console.log('='.repeat(70));
}

rollbackPickConfirmation().catch(console.error);
