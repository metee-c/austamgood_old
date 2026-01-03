/**
 * Reset Production Data Script
 * ลบข้อมูลการผลิตและถอยสต็อกเพื่อเริ่มทดสอบใหม่ตั้งแต่วางแผน
 * 
 * Usage: node scripts/reset-production-data.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetProductionData() {
  console.log('='.repeat(60));
  console.log('🔄 Reset Production Data Script');
  console.log('='.repeat(60));
  console.log('');

  try {
    // 1. ลบ production_receipt_materials
    console.log('1️⃣ ลบ production_receipt_materials...');
    const { error: err1, count: count1 } = await supabase
      .from('production_receipt_materials')
      .delete()
      .neq('receipt_id', '00000000-0000-0000-0000-000000000000'); // ลบทั้งหมด
    if (err1) console.error('   Error:', err1.message);
    else console.log(`   ✅ ลบสำเร็จ`);

    // 2. ลบ production_receipts
    console.log('2️⃣ ลบ production_receipts...');
    const { error: err2 } = await supabase
      .from('production_receipts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (err2) console.error('   Error:', err2.message);
    else console.log(`   ✅ ลบสำเร็จ`);

    // 3. ลบ production_order_items
    console.log('3️⃣ ลบ production_order_items...');
    const { error: err3 } = await supabase
      .from('production_order_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (err3) console.error('   Error:', err3.message);
    else console.log(`   ✅ ลบสำเร็จ`);

    // 4. ลบ production_orders
    console.log('4️⃣ ลบ production_orders...');
    const { error: err4 } = await supabase
      .from('production_orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (err4) console.error('   Error:', err4.message);
    else console.log(`   ✅ ลบสำเร็จ`);

    // 5. ลบ replenishment_queue ที่เกี่ยวกับ production
    console.log('5️⃣ ลบ replenishment_queue (production_order)...');
    const { error: err5 } = await supabase
      .from('replenishment_queue')
      .delete()
      .eq('trigger_source', 'production_order');
    if (err5) console.error('   Error:', err5.message);
    else console.log(`   ✅ ลบสำเร็จ`);

    // 6. ลบ stock adjustments ที่เกี่ยวกับ production
    console.log('6️⃣ ลบ wms_stock_adjustment_items (PROD-*, PKG-*)...');
    const { data: adjData } = await supabase
      .from('wms_stock_adjustments')
      .select('adjustment_id')
      .or('reference_no.like.PROD-%,reference_no.like.PKG-%');
    
    if (adjData && adjData.length > 0) {
      const adjIds = adjData.map(a => a.adjustment_id);
      
      // ลบ items ก่อน
      const { error: err6a } = await supabase
        .from('wms_stock_adjustment_items')
        .delete()
        .in('adjustment_id', adjIds);
      if (err6a) console.error('   Error (items):', err6a.message);
      
      // ลบ header
      const { error: err6b } = await supabase
        .from('wms_stock_adjustments')
        .delete()
        .in('adjustment_id', adjIds);
      if (err6b) console.error('   Error (header):', err6b.message);
      else console.log(`   ✅ ลบ ${adjIds.length} รายการสำเร็จ`);
    } else {
      console.log('   ℹ️ ไม่มีข้อมูล');
    }

    // 7. ลบ inventory_ledger ที่เกี่ยวกับ production
    console.log('7️⃣ ลบ wms_inventory_ledger (production)...');
    const { error: err7 } = await supabase
      .from('wms_inventory_ledger')
      .delete()
      .or('reference_doc_type.eq.production_receipt,reference_no.like.PROD-%,reference_no.like.PKG-%');
    if (err7) console.error('   Error:', err7.message);
    else console.log(`   ✅ ลบสำเร็จ`);

    // 8. ลบ wms_receive ที่เป็นประเภท "การผลิต"
    console.log('8️⃣ ลบ wms_receive (การผลิต)...');
    const { data: receiveData } = await supabase
      .from('wms_receive')
      .select('receive_id')
      .eq('receive_type', 'การผลิต');
    
    if (receiveData && receiveData.length > 0) {
      const receiveIds = receiveData.map(r => r.receive_id);
      
      // ลบ items ก่อน
      const { error: err8a } = await supabase
        .from('wms_receive_items')
        .delete()
        .in('receive_id', receiveIds);
      if (err8a) console.error('   Error (items):', err8a.message);
      
      // ลบ header
      const { error: err8b } = await supabase
        .from('wms_receive')
        .delete()
        .in('receive_id', receiveIds);
      if (err8b) console.error('   Error (header):', err8b.message);
      else console.log(`   ✅ ลบ ${receiveIds.length} รายการสำเร็จ`);
    } else {
      console.log('   ℹ️ ไม่มีข้อมูล');
    }

    // 9. ลบ inventory_ledger ที่เกี่ยวกับ receive การผลิต
    console.log('9️⃣ ลบ wms_inventory_ledger (receive การผลิต)...');
    const { error: err9 } = await supabase
      .from('wms_inventory_ledger')
      .delete()
      .like('reference_no', 'RCV-%')
      .eq('transaction_type', 'receive');
    // Note: อาจต้องปรับ logic ถ้าต้องการลบเฉพาะ receive การผลิต
    if (err9) console.error('   Error:', err9.message);
    else console.log(`   ✅ ลบสำเร็จ`);

    // 10. Recalculate inventory balances
    console.log('🔟 Recalculate inventory balances...');
    // ลบ balances ที่ total_piece_qty = 0
    const { error: err10 } = await supabase
      .from('wms_inventory_balances')
      .delete()
      .eq('total_piece_qty', 0);
    if (err10) console.error('   Error:', err10.message);
    else console.log(`   ✅ ลบ zero balances สำเร็จ`);

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Reset Production Data เสร็จสิ้น!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📋 สิ่งที่ถูกลบ:');
    console.log('   - production_receipt_materials');
    console.log('   - production_receipts');
    console.log('   - production_order_items');
    console.log('   - production_orders');
    console.log('   - replenishment_queue (production)');
    console.log('   - stock adjustments (PROD-*, PKG-*)');
    console.log('   - inventory_ledger (production)');
    console.log('   - wms_receive (การผลิต)');
    console.log('');
    console.log('🚀 พร้อมเริ่มทดสอบใหม่ตั้งแต่วางแผนการผลิต!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

resetProductionData();
