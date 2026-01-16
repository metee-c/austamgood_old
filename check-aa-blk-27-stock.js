const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLocation() {
  console.log('=== ตรวจสอบ Location AA-BLK-27 ===\n');

  // 1. ตรวจสอบ master_location
  console.log('1. ตรวจสอบ master_location:');
  const { data: location, error: locError } = await supabase
    .from('master_location')
    .select('*')
    .eq('location_id', 'AA-BLK-27')
    .single();
  
  if (locError) {
    console.log('❌ ไม่พบ location:', locError.message);
  } else {
    console.log('✅ พบ location:', JSON.stringify(location, null, 2));
  }

  // 2. ตรวจสอบ inventory ledger ที่เกี่ยวข้องกับ ATG20260115000000044
  console.log('\n2. ตรวจสอบ inventory_ledger ที่เกี่ยวข้องกับ ATG20260115000000044:');
  const { data: ledgers, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .or('reference_no.eq.ATG20260115000000044,move_id.eq.ATG20260115000000044')
    .order('created_at', { ascending: true });
  
  if (ledgerError) {
    console.log('❌ Error:', ledgerError.message);
  } else {
    console.log(`✅ พบ ${ledgers.length} รายการ:`);
    ledgers.forEach((ledger, idx) => {
      console.log(`\n  [${idx + 1}] Ledger ID: ${ledger.ledger_id}`);
      console.log(`      Movement Type: ${ledger.movement_type}`);
      console.log(`      Location: ${ledger.location_id}`);
      console.log(`      SKU: ${ledger.sku_id}`);
      console.log(`      Pallet: ${ledger.pallet_id || 'N/A'}`);
      console.log(`      Lot: ${ledger.lot_no || 'N/A'}`);
      console.log(`      Pack Qty: ${ledger.pack_qty || 0}`);
      console.log(`      Piece Qty: ${ledger.piece_qty || 0}`);
      console.log(`      Reference: ${ledger.reference_no}`);
      console.log(`      Created: ${ledger.created_at}`);
    });
  }

  // 3. ตรวจสอบ inventory_balances ที่ AA-BLK-27
  console.log('\n3. ตรวจสอบ wms_inventory_balances ที่ AA-BLK-27:');
  const { data: balances, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('location_id', 'AA-BLK-27');
  
  if (balanceError) {
    console.log('❌ Error:', balanceError.message);
  } else {
    console.log(`✅ พบ ${balances.length} รายการ:`);
    if (balances.length === 0) {
      console.log('   ⚠️ ไม่มียอดคงเหลือที่ location นี้!');
    } else {
      balances.forEach((balance, idx) => {
        console.log(`\n  [${idx + 1}] Balance ID: ${balance.balance_id}`);
        console.log(`      SKU: ${balance.sku_id}`);
        console.log(`      Pallet: ${balance.pallet_id || 'N/A'} (External: ${balance.pallet_id_external || 'N/A'})`);
        console.log(`      Lot: ${balance.lot_no || 'N/A'}`);
        console.log(`      Total Pack: ${balance.total_pack_qty || 0}`);
        console.log(`      Total Piece: ${balance.total_piece_qty || 0}`);
        console.log(`      Reserved Pack: ${balance.reserved_pack_qty || 0}`);
        console.log(`      Reserved Piece: ${balance.reserved_piece_qty || 0}`);
        console.log(`      Last Move: ${balance.last_move_id || 'N/A'}`);
        console.log(`      Updated: ${balance.updated_at}`);
      });
    }
  }

  // 4. ตรวจสอบ moves ที่เกี่ยวข้อง
  console.log('\n4. ตรวจสอบ wms_moves ที่เกี่ยวข้องกับ ATG20260115000000044:');
  const { data: moves, error: moveError } = await supabase
    .from('wms_moves')
    .select('*')
    .eq('move_id', 'ATG20260115000000044')
    .single();
  
  if (moveError) {
    console.log('❌ ไม่พบ move:', moveError.message);
  } else {
    console.log('✅ พบ move:', JSON.stringify(moves, null, 2));
  }

  // 5. ตรวจสอบ ledger ทั้งหมดที่ AA-BLK-27
  console.log('\n5. ตรวจสอบ ledger ทั้งหมดที่ AA-BLK-27 (10 รายการล่าสุด):');
  const { data: allLedgers, error: allLedgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('location_id', 'AA-BLK-27')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (allLedgerError) {
    console.log('❌ Error:', allLedgerError.message);
  } else {
    console.log(`✅ พบ ${allLedgers.length} รายการล่าสุด:`);
    allLedgers.forEach((ledger, idx) => {
      console.log(`\n  [${idx + 1}] ${ledger.movement_type} - ${ledger.sku_id}`);
      console.log(`      Piece Qty: ${ledger.piece_qty || 0}`);
      console.log(`      Reference: ${ledger.reference_no}`);
      console.log(`      Created: ${ledger.created_at}`);
    });
  }

  // 6. สรุปปัญหา
  console.log('\n=== สรุป ===');
  if (ledgers && ledgers.length > 0) {
    const hasReceiving = ledgers.some(l => l.movement_type === 'receiving' || l.movement_type === 'transfer_in');
    const totalPieceIn = ledgers
      .filter(l => l.movement_type === 'receiving' || l.movement_type === 'transfer_in')
      .reduce((sum, l) => sum + (l.piece_qty || 0), 0);
    const totalPieceOut = ledgers
      .filter(l => l.movement_type === 'transfer_out' || l.movement_type === 'picking')
      .reduce((sum, l) => sum + Math.abs(l.piece_qty || 0), 0);
    
    console.log(`📊 Ledger มีการเคลื่อนไหว: ${hasReceiving ? 'มี' : 'ไม่มี'}`);
    console.log(`📊 ชิ้นเข้า: ${totalPieceIn}`);
    console.log(`📊 ชิ้นออก: ${totalPieceOut}`);
    console.log(`📊 คาดว่าคงเหลือ: ${totalPieceIn - totalPieceOut}`);
  }
  
  if (balances && balances.length === 0) {
    console.log('⚠️ ปัญหา: มี ledger แต่ไม่มี balance!');
    console.log('💡 อาจเป็นเพราะ:');
    console.log('   1. Trigger sync_inventory_ledger_to_balance ไม่ทำงาน');
    console.log('   2. Balance ถูกลบหรือ reset');
    console.log('   3. มีการ transfer_out ทั้งหมดแล้ว');
  }
}

checkLocation().catch(console.error);
