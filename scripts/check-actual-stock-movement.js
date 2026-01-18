/**
 * ตรวจสอบว่ามีการย้ายสต็อกจริงหรือไม่
 * และตรวจสอบสถานะปัจจุบันของสต็อก
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkActualStockMovement() {
  console.log('='.repeat(80));
  console.log('🔍 ตรวจสอบการย้ายสต็อกและสถานะปัจจุบัน');
  console.log('='.repeat(80));
  console.log();

  // 1. ตรวจสอบ Ledger entries ทั้งหมดที่เกี่ยวข้อง
  console.log('1️⃣  Ledger entries ที่เกี่ยวข้องกับ B-BEY-D|MNB|NS|010:');
  console.log('-'.repeat(80));
  
  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('sku_id', 'B-BEY-D|MNB|NS|010')
    .or('location_id.eq.A08-01-011,location_id.eq.Dispatch')
    .order('created_at', { ascending: false })
    .limit(20);

  if (ledgerError) {
    console.error('❌ Error:', ledgerError.message);
  } else {
    console.log(`พบ ${ledgerEntries.length} Ledger entries:`);
    ledgerEntries.forEach(entry => {
      console.log(`  - Ledger ${entry.ledger_id}: ${entry.transaction_type}`);
      console.log(`    ${entry.direction === 'out' ? '📤' : '📥'} ${entry.direction.toUpperCase()}: ${entry.location_id}`);
      console.log(`    จำนวน: ${entry.piece_qty} pieces`);
      console.log(`    Pallet: ${entry.pallet_id}`);
      console.log(`    วันที่: ${entry.created_at}`);
      console.log(`    Remarks: ${entry.remarks || 'N/A'}`);
      console.log();
    });
  }

  // 2. ตรวจสอบสต็อกที่ A08-01-011
  console.log('2️⃣  สต็อกที่ A08-01-011:');
  console.log('-'.repeat(80));
  
  const { data: stockA08, error: stockA08Error } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('location_id', 'A08-01-011')
    .eq('sku_id', 'B-BEY-D|MNB|NS|010');

  if (stockA08Error) {
    console.error('❌ Error:', stockA08Error.message);
  } else {
    if (stockA08.length === 0) {
      console.log('⚠️  ไม่พบสต็อกที่ A08-01-011');
    } else {
      stockA08.forEach(balance => {
        console.log(`  📦 Balance ${balance.balance_id}:`);
        console.log(`     Pallet: ${balance.pallet_id}`);
        console.log(`     Total: ${balance.total_piece_qty} pieces`);
        console.log(`     Reserved: ${balance.reserved_piece_qty} pieces`);
        console.log(`     Available: ${balance.total_piece_qty - balance.reserved_piece_qty} pieces`);
      });
    }
  }
  console.log();

  // 3. ตรวจสอบสต็อกที่ Dispatch
  console.log('3️⃣  สต็อกที่ Dispatch:');
  console.log('-'.repeat(80));
  
  const { data: stockDispatch, error: stockDispatchError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('location_id', 'Dispatch')
    .eq('sku_id', 'B-BEY-D|MNB|NS|010');

  if (stockDispatchError) {
    console.error('❌ Error:', stockDispatchError.message);
  } else {
    if (stockDispatch.length === 0) {
      console.log('⚠️  ไม่พบสต็อกที่ Dispatch');
    } else {
      stockDispatch.forEach(balance => {
        console.log(`  📦 Balance ${balance.balance_id}:`);
        console.log(`     Pallet: ${balance.pallet_id}`);
        console.log(`     Total: ${balance.total_piece_qty} pieces`);
        console.log(`     Reserved: ${balance.reserved_piece_qty} pieces`);
        console.log(`     Available: ${balance.total_piece_qty - balance.reserved_piece_qty} pieces`);
      });
    }
  }
  console.log();

  // 4. ตรวจสอบ Loadlist LD-20260115-0023
  console.log('4️⃣  Loadlist LD-20260115-0023:');
  console.log('-'.repeat(80));
  
  const { data: loadlist, error: loadlistError } = await supabase
    .from('loadlists')
    .select('*')
    .eq('loadlist_code', 'LD-20260115-0023')
    .single();

  if (loadlistError) {
    console.error('❌ Error:', loadlistError.message);
  } else {
    console.log(`  Loadlist ID: ${loadlist.id}`);
    console.log(`  Status: ${loadlist.status}`);
    console.log(`  Created: ${loadlist.created_at}`);
    console.log(`  Loaded: ${loadlist.loaded_at || 'N/A'}`);
  }
  console.log();

  // 5. สรุป
  console.log('='.repeat(80));
  console.log('📊 สรุป');
  console.log('='.repeat(80));
  console.log();
  
  if (ledgerEntries && ledgerEntries.length > 0) {
    const hasMovement = ledgerEntries.some(e => 
      e.remarks && (
        e.remarks.includes('Fix stock') || 
        e.remarks.includes('fix-stock-for-affected-loadlists')
      )
    );
    
    if (hasMovement) {
      console.log('✅ พบการย้ายสต็อกโดย fix script');
      console.log('   → ต้อง Rollback');
    } else {
      console.log('⚠️  ไม่พบการย้ายสต็อกโดย fix script');
      console.log('   → อาจไม่ได้รัน script หรือถูก Rollback ไปแล้ว');
    }
  }
  
  console.log();
  console.log('💡 ขั้นตอนต่อไป:');
  console.log('   1. ตรวจสอบสต็อกจริงที่คลัง');
  console.log('   2. ถ้าสต็อกจริงอยู่ที่ A08-01-011 → ไม่ต้อง Rollback');
  console.log('   3. ถ้าสต็อกจริงถูกย้ายไป Dispatch → ต้อง Rollback');
  console.log();
}

checkActualStockMovement()
  .then(() => {
    console.log('✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
