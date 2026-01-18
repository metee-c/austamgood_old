const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyConcurrentPickConfirmation() {
  console.log('🔍 ตรวจสอบการยืนยันหยิบพร้อมกัน 3 ใบ (PL-312, PL-313, PL-314)...\n');

  const picklistIds = [312, 313, 314];

  // 1. ตรวจสอบสถานะของ picklists
  console.log('📋 1. ตรวจสอบสถานะ Picklists:');
  console.log('='.repeat(70));
  
  const { data: picklists, error: picklistError } = await supabase
    .from('picklists')
    .select('id, picklist_code, status, created_at, picking_started_at, picking_completed_at')
    .in('id', picklistIds)
    .order('id');

  if (picklistError) {
    console.error('❌ Error:', picklistError);
    return;
  }

  picklists.forEach(pl => {
    const statusIcon = pl.status === 'completed' ? '✅' : '⚠️';
    console.log(`${statusIcon} ${pl.picklist_code} (ID: ${pl.id})`);
    console.log(`   Status: ${pl.status}`);
    console.log(`   Started At: ${pl.picking_started_at || 'Not started'}`);
    console.log(`   Completed At: ${pl.picking_completed_at || 'Not completed'}`);
    console.log('');
  });

  // 2. ตรวจสอบ picklist items
  console.log('\n📦 2. ตรวจสอบ Picklist Items:');
  console.log('='.repeat(70));

  for (const picklistId of picklistIds) {
    const { data: items, error: itemsError } = await supabase
      .from('picklist_items')
      .select(`
        id,
        sku_id,
        quantity_to_pick,
        quantity_picked,
        status,
        picked_at,
        master_sku (
          sku_id,
          sku_name
        )
      `)
      .eq('picklist_id', picklistId);

    if (itemsError) {
      console.error(`❌ Error fetching items for picklist ${picklistId}:`, itemsError);
      continue;
    }

    const picklist = picklists.find(p => p.id === picklistId);
    console.log(`\n📝 ${picklist.picklist_code} - ${items.length} รายการ:`);
    
    let allPicked = true;
    let totalToPick = 0;
    let totalPicked = 0;

    items.forEach(item => {
      const sku = item.master_sku;
      const isPicked = item.status === 'picked';
      const icon = isPicked ? '✅' : '❌';
      
      totalToPick += parseFloat(item.quantity_to_pick || 0);
      totalPicked += parseFloat(item.quantity_picked || 0);
      
      if (!isPicked) allPicked = false;

      console.log(`   ${icon} ${item.sku_id}: ${sku?.sku_name || 'N/A'}`);
      console.log(`      To Pick: ${item.quantity_to_pick}, Picked: ${item.quantity_picked || 0}`);
      console.log(`      Status: ${item.status}, Picked At: ${item.picked_at || 'Not picked'}`);
    });

    console.log(`\n   📊 สรุป: ${allPicked ? '✅ หยิบครบทุกรายการ' : '⚠️ ยังหยิบไม่ครบ'}`);
    console.log(`   Total To Pick: ${totalToPick}, Total Picked: ${totalPicked}`);
  }

  // 3. ตรวจสอบ reservations - ต้องถูกปล่อยหมดแล้ว
  console.log('\n\n🔒 3. ตรวจสอบ Reservations (ต้องถูกปล่อยหมดแล้ว):');
  console.log('='.repeat(70));

  for (const picklistId of picklistIds) {
    const { data: reservations, error: resError } = await supabase
      .from('picklist_item_reservations')
      .select(`
        reservation_id,
        status,
        reserved_piece_qty,
        reserved_pack_qty,
        released_at,
        picked_at,
        picklist_items!inner (
          picklist_id
        )
      `)
      .eq('picklist_items.picklist_id', picklistId);

    if (resError) {
      console.error(`❌ Error fetching reservations for picklist ${picklistId}:`, resError);
      continue;
    }

    const picklist = picklists.find(p => p.id === picklistId);
    console.log(`\n📝 ${picklist.picklist_code}:`);
    
    if (!reservations || reservations.length === 0) {
      console.log('   ⚠️ ไม่พบ reservations');
      continue;
    }

    const activeReservations = reservations.filter(r => r.status === 'active');
    const pickedReservations = reservations.filter(r => r.status === 'picked');
    const releasedReservations = reservations.filter(r => r.status === 'released');

    console.log(`   Total Reservations: ${reservations.length}`);
    console.log(`   - Active: ${activeReservations.length} ${activeReservations.length > 0 ? '⚠️' : '✅'}`);
    console.log(`   - Picked: ${pickedReservations.length} ${pickedReservations.length === reservations.length ? '✅' : ''}`);
    console.log(`   - Released: ${releasedReservations.length}`);

    if (activeReservations.length > 0) {
      console.log('\n   ⚠️ พบ Active Reservations ที่ยังไม่ได้ปล่อย:');
      activeReservations.forEach(r => {
        console.log(`      - Reservation ${r.reservation_id}: ${r.reserved_piece_qty} pieces, ${r.reserved_pack_qty} packs`);
      });
    }
  }

  // 4. ตรวจสอบยอดจองในระบบ
  console.log('\n\n📊 4. ตรวจสอบยอดจองทั้งหมดในระบบ:');
  console.log('='.repeat(70));

  const { data: allBalances, error: balanceError } = await supabase
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
  } else {
    const totalReservedPieces = allBalances.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0);
    const totalReservedPacks = allBalances.reduce((sum, b) => sum + (b.reserved_pack_qty || 0), 0);

    console.log(`\n✅ พบ ${allBalances.length} รายการที่มียอดจอง`);
    console.log(`📊 รวมยอดจองทั้งหมด: ${totalReservedPieces} pieces, ${totalReservedPacks} packs`);

    if (allBalances.length > 0) {
      console.log('\nรายละเอียด:');
      allBalances.slice(0, 10).forEach(balance => {
        const sku = balance.master_sku;
        const location = balance.master_location;
        console.log(`\n   📦 ${balance.sku_id} - ${sku?.sku_name || 'N/A'}`);
        console.log(`      Location: ${location?.location_code || balance.location_id}`);
        console.log(`      Pallet: ${balance.pallet_id || 'N/A'}`);
        console.log(`      Reserved: ${balance.reserved_piece_qty} pieces, ${balance.reserved_pack_qty} packs`);
        console.log(`      Total: ${balance.total_piece_qty} pieces, ${balance.total_pack_qty} packs`);
      });

      if (allBalances.length > 10) {
        console.log(`\n   ... และอีก ${allBalances.length - 10} รายการ`);
      }
    }
  }

  // 5. ตรวจสอบ inventory ledger entries
  console.log('\n\n📖 5. ตรวจสอบ Inventory Ledger Entries:');
  console.log('='.repeat(70));

  for (const picklistId of picklistIds) {
    const picklist = picklists.find(p => p.id === picklistId);
    
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .select(`
        ledger_id,
        transaction_type,
        sku_id,
        piece_qty,
        pack_qty,
        location_id,
        pallet_id,
        reference_document_type,
        reference_document_id,
        created_at
      `)
      .eq('reference_document_type', 'picklist')
      .eq('reference_document_id', picklistId)
      .order('created_at', { ascending: false });

    if (ledgerError) {
      console.error(`❌ Error fetching ledger for picklist ${picklistId}:`, ledgerError);
      continue;
    }

    console.log(`\n📝 ${picklist.picklist_code}:`);
    
    if (!ledgerEntries || ledgerEntries.length === 0) {
      console.log('   ⚠️ ไม่พบ ledger entries');
      continue;
    }

    console.log(`   Total Entries: ${ledgerEntries.length}`);
    
    const pickEntries = ledgerEntries.filter(e => e.transaction_type === 'pick');
    const reserveEntries = ledgerEntries.filter(e => e.transaction_type === 'reserve');
    const releaseEntries = ledgerEntries.filter(e => e.transaction_type === 'release_reservation');

    console.log(`   - Pick: ${pickEntries.length}`);
    console.log(`   - Reserve: ${reserveEntries.length}`);
    console.log(`   - Release: ${releaseEntries.length}`);

    if (pickEntries.length > 0) {
      console.log('\n   ✅ Pick Entries (ล่าสุด 5 รายการ):');
      pickEntries.slice(0, 5).forEach(entry => {
        console.log(`      - ${entry.sku_id}: ${entry.piece_qty} pieces from ${entry.location_id}/${entry.pallet_id}`);
      });
    }
  }

  // 6. สรุปผลการตรวจสอบ
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 สรุปผลการตรวจสอบ');
  console.log('='.repeat(70));

  const allConfirmed = picklists.every(p => p.status === 'completed');
  const allHaveCompletedAt = picklists.every(p => p.picking_completed_at !== null);

  console.log(`\n✅ Picklists Status: ${allConfirmed ? 'ทั้ง 3 ใบเป็น completed' : '⚠️ มีบางใบยังไม่ completed'}`);
  console.log(`✅ Completed Timestamp: ${allHaveCompletedAt ? 'ทั้ง 3 ใบมี picking_completed_at' : '⚠️ มีบางใบไม่มี picking_completed_at'}`);

  // ตรวจสอบว่ามี race condition หรือไม่
  if (allHaveCompletedAt) {
    const completedTimes = picklists.map(p => new Date(p.picking_completed_at).getTime());
    const timeDiffs = [];
    for (let i = 1; i < completedTimes.length; i++) {
      timeDiffs.push(Math.abs(completedTimes[i] - completedTimes[i-1]));
    }
    
    const maxDiff = Math.max(...timeDiffs);
    console.log(`\n⏱️ ระยะเวลาระหว่างการยืนยัน:`);
    picklists.forEach(p => {
      console.log(`   - ${p.picklist_code}: ${new Date(p.picking_completed_at).toISOString()}`);
    });
    console.log(`\n   Max time difference: ${maxDiff}ms (${(maxDiff/1000).toFixed(2)}s)`);
    
    if (maxDiff < 5000) {
      console.log('   ✅ ยืนยันพร้อมกันภายใน 5 วินาที - ทดสอบ concurrent ได้');
    }
  }

  console.log('\n' + '='.repeat(70));
}

verifyConcurrentPickConfirmation().catch(console.error);
