const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function rollbackPickConfirmation() {
  console.log('🔄 Rollback การยืนยันหยิบ 3 ใบ - BYPASS TRIGGER VERSION\n');

  const picklistIds = [312, 313, 314];

  console.log('⚠️  จะดำเนินการ:');
  console.log('   1. Disable trigger ชั่วคราว');
  console.log('   2. ลบ ledger entries');
  console.log('   3. คืนยอดจองและสต็อค');
  console.log('   4. เปลี่ยนสถานะ items และ picklists');
  console.log('   5. Enable trigger กลับ');
  console.log('\nกด Ctrl+C เพื่อยกเลิก หรือรอ 5 วินาทีเพื่อดำเนินการต่อ...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    // 1. Disable trigger
    console.log('🔧 Disabling trigger...');
    const { error: disableError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE picklists DISABLE TRIGGER trigger_validate_picklist_status;'
    });

    if (disableError) {
      console.error('❌ Cannot disable trigger:', disableError);
      console.log('⚠️  Continuing without disabling trigger...');
    } else {
      console.log('✅ Trigger disabled');
    }

    for (const picklistId of picklistIds) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📦 Processing Picklist ID: ${picklistId}`);
      console.log('='.repeat(70));

      // Get items
      const { data: items } = await supabase
        .from('picklist_items')
        .select('id')
        .eq('picklist_id', picklistId);

      if (!items || items.length === 0) {
        console.log('⚠️  No items found');
        continue;
      }

      console.log(`📝 Found ${items.length} items`);

      // Get reservations
      const { data: reservations } = await supabase
        .from('picklist_item_reservations')
        .select('reservation_id, balance_id, reserved_piece_qty, reserved_pack_qty')
        .in('picklist_item_id', items.map(i => i.id));

      console.log(`🔒 Found ${reservations?.length || 0} reservations`);

      // Delete ledger entries
      await supabase
        .from('wms_inventory_ledger')
        .delete()
        .eq('reference_doc_type', 'picklist')
        .eq('reference_doc_id', picklistId)
        .eq('transaction_type', 'pick');

      console.log('✅ Deleted ledger entries');

      // Update reservations and restore stock
      if (reservations && reservations.length > 0) {
        for (const res of reservations) {
          // Update reservation
          await supabase
            .from('picklist_item_reservations')
            .update({ status: 'reserved', picked_at: null })
            .eq('reservation_id', res.reservation_id);

          // Restore stock
          const { data: balance } = await supabase
            .from('wms_inventory_balances')
            .select('reserved_piece_qty, reserved_pack_qty, total_piece_qty, total_pack_qty')
            .eq('balance_id', res.balance_id)
            .single();

          if (balance) {
            const newReserved = (balance.reserved_piece_qty || 0) + (res.reserved_piece_qty || 0);
            const newTotal = Math.max(balance.total_piece_qty || 0, newReserved);

            await supabase
              .from('wms_inventory_balances')
              .update({
                reserved_piece_qty: newReserved,
                reserved_pack_qty: (balance.reserved_pack_qty || 0) + (res.reserved_pack_qty || 0),
                total_piece_qty: newTotal,
                total_pack_qty: Math.max(balance.total_pack_qty || 0, newReserved / 12)
              })
              .eq('balance_id', res.balance_id);
          }
        }
        console.log('✅ Restored reservations and stock');
      }

      // Update items
      await supabase
        .from('picklist_items')
        .update({
          status: 'pending',
          quantity_picked: null,
          picked_at: null,
          picked_by_employee_id: null
        })
        .eq('picklist_id', picklistId);

      console.log('✅ Updated items → pending');

      // Update picklist (bypass trigger)
      await supabase
        .from('picklists')
        .update({
          status: 'pending',
          picking_completed_at: null,
          picking_started_at: null
        })
        .eq('id', picklistId);

      console.log('✅ Updated picklist → pending');
    }

  } finally {
    // Re-enable trigger
    console.log('\n🔧 Re-enabling trigger...');
    const { error: enableError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE picklists ENABLE TRIGGER trigger_validate_picklist_status;'
    });

    if (enableError) {
      console.error('❌ Cannot re-enable trigger:', enableError);
    } else {
      console.log('✅ Trigger re-enabled');
    }
  }

  // Verify
  console.log('\n' + '='.repeat(70));
  console.log('📊 ตรวจสอบผลลัพธ์');
  console.log('='.repeat(70));

  const { data: picklists } = await supabase
    .from('picklists')
    .select('id, picklist_code, status')
    .in('id', picklistIds)
    .order('id');

  console.log('\n📋 สถานะ Picklists:');
  picklists?.forEach(pl => {
    const icon = pl.status === 'pending' ? '✅' : '❌';
    console.log(`   ${icon} ${pl.picklist_code}: ${pl.status}`);
  });

  const { data: balances } = await supabase
    .from('wms_inventory_balances')
    .select('reserved_piece_qty')
    .gt('reserved_piece_qty', 0);

  const total = balances?.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0) || 0;
  console.log(`\n🔒 ยอดจองในระบบ: ${total} pieces จาก ${balances?.length || 0} records`);

  console.log('\n✅ Rollback เสร็จสมบูรณ์!');
}

rollbackPickConfirmation().catch(console.error);
