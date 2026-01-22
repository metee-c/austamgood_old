require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllIssues() {
  console.log('\n🔍 ตรวจสอบปัญหาทั้งหมด\n');
  console.log('='.repeat(80));
  
  // ========================================
  // ISSUE 1: API Route 404 - Quick Move
  // ========================================
  console.log('\n📌 ISSUE 1: API Route /api/moves/quick-move');
  console.log('-'.repeat(80));
  
  // Check if file exists
  const fs = require('fs');
  const apiPath = 'app/api/moves/quick-move/route.ts';
  if (fs.existsSync(apiPath)) {
    console.log(`✅ ไฟล์ ${apiPath} มีอยู่`);
  } else {
    console.log(`❌ ไฟล์ ${apiPath} ไม่พบ`);
  }
  
  // Check if .next folder exists
  if (fs.existsSync('.next')) {
    console.log('⚠️  โฟลเดอร์ .next มีอยู่ - อาจต้องลบและ build ใหม่');
  }
  
  // ========================================
  // ISSUE 2: Pallet ATG20260122000000039
  // ========================================
  console.log('\n📌 ISSUE 2: Pallet ATG20260122000000039');
  console.log('-'.repeat(80));
  
  const palletId = 'ATG20260122000000039';
  
  // Check balance
  const { data: balance, error: balError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', palletId);
  
  if (balError) {
    console.log(`❌ Error checking balance: ${balError.message}`);
  } else if (!balance || balance.length === 0) {
    console.log('❌ ไม่พบ balance record');
    
    // Check ledger
    const { data: ledger } = await supabase
      .from('wms_inventory_ledger')
      .select('*')
      .eq('pallet_id', palletId)
      .order('created_at', { ascending: true });
    
    if (ledger && ledger.length > 0) {
      console.log(`✅ พบ ${ledger.length} ledger entries`);
      console.log('   → ต้องสร้าง balance จาก ledger');
      
      // Calculate balance from ledger
      let totalQty = 0;
      ledger.forEach(entry => {
        totalQty += entry.quantity_change || 0;
      });
      console.log(`   → Balance ที่ควรเป็น: ${totalQty} ชิ้น`);
    } else {
      console.log('❌ ไม่พบ ledger entries เลย');
    }
  } else {
    console.log(`✅ พบ balance: ${balance[0].total_piece_qty} ชิ้น @ ${balance[0].location_id}`);
  }
  
  // ========================================
  // ISSUE 3: Order IV26011258 Rollback
  // ========================================
  console.log('\n📌 ISSUE 3: Order IV26011258 Rollback');
  console.log('-'.repeat(80));
  
  const orderNo = 'IV26011258';
  
  // Check order
  const { data: order, error: orderError } = await supabase
    .from('wms_orders')
    .select('order_id, order_no, status, confirmed_at')
    .eq('order_no', orderNo)
    .single();
  
  if (orderError) {
    console.log(`❌ Error: ${orderError.message}`);
  } else if (!order) {
    console.log('❌ ไม่พบ Order');
  } else {
    console.log(`✅ พบ Order: ${order.order_no}`);
    console.log(`   - Order ID: ${order.order_id}`);
    console.log(`   - Status: ${order.status}`);
    console.log(`   - Confirmed At: ${order.confirmed_at || 'N/A'}`);
    
    // Check if can rollback
    if (order.status === 'draft') {
      console.log('   ⚠️  Order อยู่ในสถานะ draft อยู่แล้ว');
    } else if (['in_transit', 'delivered'].includes(order.status)) {
      console.log('   ❌ ไม่สามารถ rollback ได้ (in_transit/delivered)');
    } else {
      console.log('   ✅ สามารถ rollback ได้');
      
      // Check document items
      const { data: picklistItems } = await supabase
        .from('picklist_items')
        .select('id, status')
        .eq('order_id', order.order_id)
        .is('voided_at', null);
      
      const { data: faceSheetItems } = await supabase
        .from('face_sheet_items')
        .select('id, status')
        .eq('order_id', order.order_id)
        .is('voided_at', null);
      
      const { data: bonusItems } = await supabase
        .from('wms_order_items')
        .select('order_item_id')
        .eq('order_id', order.order_id);
      
      let bonusFaceSheetItems = [];
      if (bonusItems && bonusItems.length > 0) {
        const orderItemIds = bonusItems.map(oi => oi.order_item_id);
        const { data: bfsItems } = await supabase
          .from('bonus_face_sheet_items')
          .select('id, status')
          .in('order_item_id', orderItemIds)
          .is('voided_at', null);
        bonusFaceSheetItems = bfsItems || [];
      }
      
      const { data: routeStops } = await supabase
        .from('receiving_route_stops')
        .select('stop_id, trip_id')
        .eq('order_id', order.order_id);
      
      console.log(`   - Picklist Items: ${picklistItems?.length || 0}`);
      console.log(`   - Face Sheet Items: ${faceSheetItems?.length || 0}`);
      console.log(`   - Bonus Face Sheet Items: ${bonusFaceSheetItems.length}`);
      console.log(`   - Route Stops: ${routeStops?.length || 0}`);
      
      if (routeStops && routeStops.length > 0) {
        console.log('   ⚠️  Order อยู่ใน Route Plan - จะถูกนำออกเมื่อ rollback');
      }
    }
  }
  
  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 สรุป');
  console.log('='.repeat(80));
  console.log('\n✅ ปัญหาที่แก้ไขแล้ว:');
  console.log('   1. Foreign Key constraint ของ wms_move_items.executed_by (Migration 287)');
  console.log('   2. Balance doubling bug (Migrations 288, 289)');
  console.log('   3. Reservation system ถูกลบออกแล้ว');
  
  console.log('\n⚠️  ปัญหาที่ต้องแก้ไข:');
  console.log('   1. API Route 404 - ต้อง restart dev server');
  console.log('   2. Pallet ATG20260122000000039 - ต้องสร้าง balance');
  console.log('   3. Order IV26011258 - ต้อง rollback ผ่าน script');
  
  console.log('\n');
}

checkAllIssues().catch(console.error);
