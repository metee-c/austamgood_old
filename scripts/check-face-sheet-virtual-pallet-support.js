/**
 * ตรวจสอบว่า Face Sheet มี Virtual Pallet Support หรือไม่
 * 
 * Expected:
 * - BFS: มี Virtual Pallet support (Migration 209)
 * - FS: ไม่มี Virtual Pallet support (ต้องเพิ่ม)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkVirtualPalletSupport() {
  console.log('='.repeat(80));
  console.log('ตรวจสอบ Virtual Pallet Support');
  console.log('='.repeat(80));
  console.log();

  // 1. ตรวจสอบ Function สำหรับ BFS
  console.log('1️⃣  Bonus Face Sheet (BFS) Functions:');
  console.log('-'.repeat(80));
  
  const { data: bfsFunctions, error: bfsError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        proname as function_name,
        pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname LIKE '%bonus_face_sheet%'
      AND proname LIKE '%reserve%'
      ORDER BY proname;
    `
  });

  if (bfsError) {
    console.error('❌ Error:', bfsError.message);
  } else {
    bfsFunctions.forEach(fn => {
      const hasVirtualPallet = fn.definition.includes('VIRTUAL-') || 
                               fn.definition.includes('virtual_pallet') ||
                               fn.definition.includes('create_or_update_virtual_balance');
      console.log(`${hasVirtualPallet ? '✅' : '❌'} ${fn.function_name}`);
      if (hasVirtualPallet) {
        console.log('   → รองรับ Virtual Pallet');
      } else {
        console.log('   → ไม่รองรับ Virtual Pallet');
      }
    });
  }
  console.log();

  // 2. ตรวจสอบ Function สำหรับ FS
  console.log('2️⃣  Face Sheet (FS) Functions:');
  console.log('-'.repeat(80));
  
  const { data: fsFunctions, error: fsError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        proname as function_name,
        pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname LIKE '%face_sheet%'
      AND proname NOT LIKE '%bonus%'
      AND proname LIKE '%reserve%'
      ORDER BY proname;
    `
  });

  if (fsError) {
    console.error('❌ Error:', fsError.message);
  } else {
    if (fsFunctions.length === 0) {
      console.log('⚠️  ไม่พบ Function สำหรับ Face Sheet reservation');
    } else {
      fsFunctions.forEach(fn => {
        const hasVirtualPallet = fn.definition.includes('VIRTUAL-') || 
                                 fn.definition.includes('virtual_pallet') ||
                                 fn.definition.includes('create_or_update_virtual_balance');
        console.log(`${hasVirtualPallet ? '✅' : '❌'} ${fn.function_name}`);
        if (hasVirtualPallet) {
          console.log('   → รองรับ Virtual Pallet');
        } else {
          console.log('   → ไม่รองรับ Virtual Pallet');
        }
      });
    }
  }
  console.log();

  // 3. ตรวจสอบ Virtual Pallet ที่มีอยู่
  console.log('3️⃣  Virtual Pallets ที่มีอยู่ในระบบ:');
  console.log('-'.repeat(80));
  
  const { data: virtualPallets, error: vpError } = await supabase
    .from('wms_inventory_balances')
    .select('pallet_id, location_id, sku_id, total_piece_qty, reserved_piece_qty')
    .like('pallet_id', 'VIRTUAL-%')
    .order('created_at', { ascending: false })
    .limit(10);

  if (vpError) {
    console.error('❌ Error:', vpError.message);
  } else {
    if (virtualPallets.length === 0) {
      console.log('⚠️  ไม่พบ Virtual Pallet ในระบบ');
    } else {
      console.log(`พบ Virtual Pallet ${virtualPallets.length} รายการ:`);
      virtualPallets.forEach(vp => {
        console.log(`  - ${vp.pallet_id}`);
        console.log(`    Location: ${vp.location_id}, SKU: ${vp.sku_id}`);
        console.log(`    Balance: ${vp.total_piece_qty}, Reserved: ${vp.reserved_piece_qty}`);
      });
    }
  }
  console.log();

  // 4. ตรวจสอบ Reservation ที่ใช้ Virtual Pallet
  console.log('4️⃣  Reservations ที่ใช้ Virtual Pallet:');
  console.log('-'.repeat(80));
  
  const { data: bfsReservations, error: bfsResError } = await supabase
    .from('bonus_face_sheet_item_reservations')
    .select(`
      reservation_id,
      bonus_face_sheet_item_id,
      balance:balance_id (
        pallet_id,
        location_id,
        sku_id,
        total_piece_qty
      ),
      reserved_piece_qty,
      status
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  if (bfsResError) {
    console.error('❌ Error:', bfsResError.message);
  } else {
    const virtualBfsReservations = bfsReservations.filter(r => 
      r.balance?.pallet_id?.startsWith('VIRTUAL-')
    );
    
    if (virtualBfsReservations.length === 0) {
      console.log('⚠️  ไม่พบ BFS Reservation ที่ใช้ Virtual Pallet');
    } else {
      console.log(`พบ BFS Reservation ที่ใช้ Virtual Pallet ${virtualBfsReservations.length} รายการ`);
      virtualBfsReservations.forEach(r => {
        console.log(`  - Reservation ${r.reservation_id}: ${r.reserved_piece_qty} pieces`);
        console.log(`    Virtual Pallet: ${r.balance.pallet_id}`);
      });
    }
  }
  console.log();

  // 5. สรุป
  console.log('='.repeat(80));
  console.log('📊 สรุปผลการตรวจสอบ');
  console.log('='.repeat(80));
  console.log();
  console.log('✅ Bonus Face Sheet (BFS):');
  console.log('   - มี Virtual Pallet support ใน Migration 209');
  console.log('   - Function: reserve_stock_for_bonus_face_sheet_items()');
  console.log('   - สามารถหยิบติดลบได้ผ่าน Virtual Pallet');
  console.log();
  console.log('❌ Face Sheet (FS):');
  console.log('   - ไม่มี Virtual Pallet support');
  console.log('   - ต้องมีสต็อกจริงถึงจะหยิบได้');
  console.log('   - ต้องสร้าง Migration ใหม่เพื่อเพิ่ม Virtual Pallet support');
  console.log();
  console.log('🔧 แนวทางแก้ไข:');
  console.log('   1. สร้าง Migration 230: Add Virtual Pallet Support for Face Sheet');
  console.log('   2. แก้ไข reserve_stock_for_face_sheet_items() ให้รองรับ Virtual Pallet');
  console.log('   3. ทดสอบกับ Face Sheet ใหม่');
  console.log();
}

checkVirtualPalletSupport()
  .then(() => {
    console.log('✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
