/**
 * ตรวจสอบว่าทำไม B-BEY-D|MNB|NS|010 ไม่ทำงานผ่าน Virtual Pallet
 * และต้องย้ายสต็อกจาก A08-01-011 แทน
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  console.log('🔍 ตรวจสอบ Virtual Pallet System สำหรับ B-BEY-D|MNB|NS|010\n');
  console.log('='.repeat(70));
  
  const SKU = 'B-BEY-D|MNB|NS|010';
  const LOADLIST_ID = 220;
  
  // 1. ตรวจสอบ Face Sheet items
  console.log('\n📋 1. Face Sheet Items ที่ต้องการ SKU นี้:');
  const { data: fsLinks } = await supabase
    .from('loadlist_face_sheets')
    .select('face_sheet_id')
    .eq('loadlist_id', LOADLIST_ID);
  
  const faceSheetIds = fsLinks?.map(l => l.face_sheet_id) || [];
  
  const { data: fsItems } = await supabase
    .from('face_sheet_items')
    .select('*')
    .in('face_sheet_id', faceSheetIds)
    .eq('sku_id', SKU);
  
  console.log(`   พบ ${fsItems?.length || 0} items:`);
  fsItems?.forEach(item => {
    console.log(`   - Face Sheet ID: ${item.face_sheet_id}`);
    console.log(`     Quantity Picked: ${item.quantity_picked}`);
    console.log(`     Status: ${item.status}`);
    console.log(`     Picked At: ${item.picked_at}`);
  });
  
  // 2. ตรวจสอบ Virtual Pallet
  console.log('\n🎯 2. Virtual Pallet สำหรับ SKU นี้:');
  const { data: virtualPallets } = await supabase
    .from('wms_virtual_pallets')
    .select('*')
    .eq('sku_id', SKU)
    .eq('status', 'active');
  
  if (!virtualPallets || virtualPallets.length === 0) {
    console.log('   ❌ ไม่พบ Virtual Pallet ที่ active');
  } else {
    console.log(`   ✅ พบ ${virtualPallets.length} Virtual Pallets:`);
    virtualPallets.forEach(vp => {
      console.log(`   - Virtual Pallet ID: ${vp.virtual_pallet_id}`);
      console.log(`     Total Pieces: ${vp.total_piece_qty}`);
      console.log(`     Reserved: ${vp.reserved_piece_qty}`);
      console.log(`     Available: ${vp.total_piece_qty - vp.reserved_piece_qty}`);
      console.log(`     Created: ${vp.created_at}`);
    });
  }
  
  // 3. ตรวจสอบ Reservations
  console.log('\n📌 3. Reservations สำหรับ Face Sheet items:');
  if (fsItems && fsItems.length > 0) {
    for (const item of fsItems) {
      const { data: reservations } = await supabase
        .from('wms_stock_reservations')
        .select('*')
        .eq('reference_doc_type', 'face_sheet')
        .eq('reference_doc_id', item.face_sheet_id)
        .eq('sku_id', SKU);
      
      console.log(`\n   Face Sheet ${item.face_sheet_id}:`);
      if (!reservations || reservations.length === 0) {
        console.log('     ❌ ไม่พบ reservations');
      } else {
        reservations.forEach(res => {
          console.log(`     - Reservation ID: ${res.reservation_id}`);
          console.log(`       Location: ${res.location_id}`);
          console.log(`       Pallet: ${res.pallet_id || 'NULL'}`);
          console.log(`       Quantity: ${res.reserved_piece_qty}`);
          console.log(`       Status: ${res.status}`);
          console.log(`       Created: ${res.created_at}`);
        });
      }
    }
  }
  
  // 4. ตรวจสอบสต็อกที่ A08-01-011
  console.log('\n📦 4. สต็อกที่ A08-01-011:');
  const { data: stockAtA08 } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('location_id', 'A08-01-011')
    .eq('sku_id', SKU);
  
  if (!stockAtA08 || stockAtA08.length === 0) {
    console.log('   ไม่มีสต็อกที่ A08-01-011 (ถูกย้ายไปแล้ว)');
  } else {
    stockAtA08.forEach(stock => {
      console.log(`   - Balance ID: ${stock.balance_id}`);
      console.log(`     Pallet: ${stock.pallet_id || 'NULL'}`);
      console.log(`     Total: ${stock.total_piece_qty}`);
      console.log(`     Reserved: ${stock.reserved_piece_qty}`);
      console.log(`     Available: ${stock.total_piece_qty - stock.reserved_piece_qty}`);
    });
  }
  
  // 5. ตรวจสอบสต็อกที่ Dispatch
  console.log('\n📍 5. สต็อกที่ Dispatch:');
  const { data: stockAtDispatch } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('location_id', 'Dispatch')
    .eq('sku_id', SKU);
  
  if (!stockAtDispatch || stockAtDispatch.length === 0) {
    console.log('   ไม่มีสต็อกที่ Dispatch');
  } else {
    stockAtDispatch.forEach(stock => {
      console.log(`   - Balance ID: ${stock.balance_id}`);
      console.log(`     Pallet: ${stock.pallet_id || 'NULL'}`);
      console.log(`     Total: ${stock.total_piece_qty}`);
      console.log(`     Reserved: ${stock.reserved_piece_qty}`);
      console.log(`     Available: ${stock.total_piece_qty - stock.reserved_piece_qty}`);
    });
  }
  
  // 6. ตรวจสอบ Ledger entries
  console.log('\n📝 6. Ledger Entries ล่าสุด (10 รายการ):');
  const { data: ledger } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('sku_id', SKU)
    .order('created_at', { ascending: false })
    .limit(10);
  
  ledger?.forEach(entry => {
    console.log(`   - ${entry.created_at}`);
    console.log(`     From: ${entry.from_location_id || 'N/A'} → To: ${entry.to_location_id || 'N/A'}`);
    console.log(`     Qty: ${entry.piece_qty_change}`);
    console.log(`     Doc: ${entry.reference_doc_type} ${entry.reference_doc_no || ''}`);
    console.log(`     Notes: ${entry.notes || 'N/A'}`);
  });
  
  // 7. สรุป
  console.log('\n' + '='.repeat(70));
  console.log('📊 สรุป:');
  console.log('='.repeat(70));
  
  console.log('\n❓ คำถาม: ทำไมต้องย้ายจาก A08-01-011 แทนที่จะใช้ Virtual Pallet?');
  console.log('\n💡 คำตอบที่เป็นไปได้:');
  console.log('   1. Virtual Pallet ไม่ถูกสร้างสำหรับ Face Sheet items');
  console.log('   2. Reservation ไม่ได้ชี้ไปที่ Virtual Pallet');
  console.log('   3. Pick Confirmation ก่อน Migration 229/230 ไม่ได้ทำงานถูกต้อง');
  console.log('   4. สต็อกค้างอยู่ที่ Storage Location (A08-01-011) แทนที่จะไปที่ Dispatch');
  
  console.log('\n🔧 สิ่งที่เกิดขึ้น:');
  console.log('   - Face Sheet ถูกหยิบก่อน 18 ม.ค. 2026 (ก่อน Migration 229/230)');
  console.log('   - Pick Confirmation ไม่ได้ปล่อย reservation และย้ายสต็อก');
  console.log('   - สต็อกยังค้างอยู่ที่ A08-01-011');
  console.log('   - Script ของเราหาสต็อกที่มีอยู่และย้ายไป Dispatch');
  console.log('   - ไม่ได้ผ่าน Virtual Pallet เพราะไม่มี Virtual Pallet สำหรับสต็อกนี้');
}

investigate().catch(console.error);
