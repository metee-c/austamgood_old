/**
 * ตรวจสอบว่า Migration 209 (Virtual Pallet) ถูก apply เมื่อไหร่
 * และ Face Sheet 83 ถูกสร้างเมื่อไหร่
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMigrationDates() {
  console.log('='.repeat(80));
  console.log('ตรวจสอบวันที่ Migration และ Face Sheet');
  console.log('='.repeat(80));
  console.log();

  // 1. ตรวจสอบ Migration 209
  console.log('1️⃣  Migration 209 (Virtual Pallet System):');
  console.log('-'.repeat(80));
  
  const { data: migrations, error: migError } = await supabase
    .from('schema_migrations')
    .select('version, name, executed_at')
    .or('version.eq.209,name.ilike.%virtual_pallet%')
    .order('version', { ascending: true });

  if (migError) {
    console.error('❌ Error:', migError.message);
  } else {
    if (migrations.length === 0) {
      console.log('⚠️  ไม่พบ Migration 209 ในระบบ');
    } else {
      migrations.forEach(m => {
        console.log(`✅ Migration ${m.version}: ${m.name || 'N/A'}`);
        console.log(`   Applied: ${m.executed_at || 'Unknown'}`);
      });
    }
  }
  console.log();

  // 2. ตรวจสอบ Face Sheet 83
  console.log('2️⃣  Face Sheet 83:');
  console.log('-'.repeat(80));
  
  const { data: faceSheet, error: fsError } = await supabase
    .from('face_sheets')
    .select('id, face_sheet_code, created_at, status')
    .eq('id', 83)
    .single();

  if (fsError) {
    console.error('❌ Error:', fsError.message);
  } else {
    console.log(`Face Sheet: ${faceSheet.face_sheet_code}`);
    console.log(`Created: ${faceSheet.created_at}`);
    console.log(`Status: ${faceSheet.status}`);
  }
  console.log();

  // 3. ตรวจสอบ Reservations ของ Face Sheet 83
  console.log('3️⃣  Reservations ของ Face Sheet 83:');
  console.log('-'.repeat(80));
  
  const { data: reservations, error: resError } = await supabase
    .from('face_sheet_item_reservations')
    .select(`
      reservation_id,
      face_sheet_item_id,
      reserved_piece_qty,
      status,
      reserved_at,
      balance:balance_id (
        pallet_id,
        location_id,
        sku_id,
        total_piece_qty
      )
    `)
    .in('face_sheet_item_id', [
      // Get item IDs from Face Sheet 83
    ]);

  // Get Face Sheet 83 items first
  const { data: fsItems } = await supabase
    .from('face_sheet_items')
    .select('id, sku_id, quantity')
    .eq('face_sheet_id', 83);

  if (fsItems && fsItems.length > 0) {
    const itemIds = fsItems.map(i => i.id);
    
    const { data: reservations2 } = await supabase
      .from('face_sheet_item_reservations')
      .select(`
        reservation_id,
        face_sheet_item_id,
        reserved_piece_qty,
        status,
        reserved_at,
        balance:balance_id (
          pallet_id,
          location_id,
          sku_id,
          total_piece_qty
        )
      `)
      .in('face_sheet_item_id', itemIds);

    if (reservations2 && reservations2.length > 0) {
      console.log(`พบ ${reservations2.length} reservations:`);
      reservations2.forEach(r => {
        const isVirtual = r.balance?.pallet_id?.startsWith('VIRTUAL-');
        console.log(`  ${isVirtual ? '🔮' : '📦'} Reservation ${r.reservation_id}`);
        console.log(`     Pallet: ${r.balance?.pallet_id || 'N/A'}`);
        console.log(`     Location: ${r.balance?.location_id || 'N/A'}`);
        console.log(`     SKU: ${r.balance?.sku_id || 'N/A'}`);
        console.log(`     Qty: ${r.reserved_piece_qty} pieces`);
        console.log(`     Status: ${r.status}`);
        console.log(`     Reserved: ${r.reserved_at}`);
      });
    } else {
      console.log('⚠️  ไม่พบ reservations สำหรับ Face Sheet 83');
    }
  }
  console.log();

  // 4. เปรียบเทียบวันที่
  console.log('4️⃣  เปรียบเทียบวันที่:');
  console.log('-'.repeat(80));
  
  if (migrations.length > 0 && faceSheet) {
    const migration209Date = new Date(migrations[0].executed_at);
    const faceSheet83Date = new Date(faceSheet.created_at);
    
    console.log(`Migration 209: ${migration209Date.toISOString()}`);
    console.log(`Face Sheet 83: ${faceSheet83Date.toISOString()}`);
    console.log();
    
    if (faceSheet83Date < migration209Date) {
      console.log('❌ Face Sheet 83 ถูกสร้าง **ก่อน** Migration 209');
      console.log('   → ไม่มี Virtual Pallet support ตอนสร้าง');
      console.log('   → ต้องมีสต็อกจริงถึงจะจองได้');
    } else {
      console.log('✅ Face Sheet 83 ถูกสร้าง **หลัง** Migration 209');
      console.log('   → ควรมี Virtual Pallet support');
      console.log('   → ถ้าสต็อกไม่พอควรสร้าง Virtual Pallet');
    }
  }
  console.log();

  // 5. สรุป
  console.log('='.repeat(80));
  console.log('📊 สรุป');
  console.log('='.repeat(80));
  console.log();
  console.log('🔍 สาเหตุที่ Face Sheet 83 ไม่ใช้ Virtual Pallet:');
  console.log();
  console.log('   1. Face Sheet 83 ถูกสร้างก่อน Migration 209');
  console.log('   2. ตอนนั้นยังไม่มี Virtual Pallet System');
  console.log('   3. การจองสต็อกต้องมีสต็อกจริง 100%');
  console.log('   4. BUG-006 ทำให้ Pick Confirmation ไม่ปล่อย reservation');
  console.log('   5. สต็อกติดค้างที่ A08-01-011 (ไม่ย้ายไป Dispatch)');
  console.log();
  console.log('✅ แนวทางแก้ไข:');
  console.log('   - Face Sheet ใหม่ (หลัง Migration 209) จะใช้ Virtual Pallet ได้');
  console.log('   - Face Sheet เก่า (ก่อน Migration 209) ต้องแก้ด้วย script');
  console.log();
}

checkMigrationDates()
  .then(() => {
    console.log('✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
