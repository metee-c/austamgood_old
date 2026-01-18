require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recreatePicklistReservations() {
  console.log('🔄 สร้างยอดจองใหม่สำหรับใบหยิบที่ยังใช้งาน\n');

  try {
    // 1. ดึงใบหยิบที่ status = pending
    const { data: picklists, error: picklistError } = await supabase
      .from('picklists')
      .select('id, picklist_code, status')
      .eq('status', 'pending')
      .order('id', { ascending: true });

    if (picklistError) throw picklistError;

    console.log(`📋 พบใบหยิบที่ยังใช้งาน: ${picklists.length} รายการ\n`);

    for (const picklist of picklists) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔄 กำลังสร้างยอดจองสำหรับ: ${picklist.picklist_code}`);
      console.log(`${'='.repeat(80)}\n`);

      // 2. ดึง picklist items
      const { data: items, error: itemsError } = await supabase
        .from('picklist_items')
        .select('id, sku_id, quantity_to_pick, source_location_id')
        .eq('picklist_id', picklist.id);

      if (itemsError) {
        console.error(`❌ Error ดึง items:`, itemsError.message);
        continue;
      }

      console.log(`📦 พบรายการสินค้า: ${items.length} รายการ`);

      let successCount = 0;
      let errorCount = 0;

      // 3. สร้าง reservation สำหรับแต่ละ item
      for (const item of items) {
        // 3.1 หา balance ที่มีสต็อกเพียงพอ (FEFO)
        const { data: balances, error: balanceError } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, location_id, pallet_id, total_piece_qty, reserved_piece_qty, expiry_date, production_date')
          .eq('warehouse_id', 'WH001')
          .eq('sku_id', item.sku_id)
          .eq('location_id', item.source_location_id)
          .gt('total_piece_qty', 0)
          .order('expiry_date', { ascending: true, nullsFirst: false })
          .order('production_date', { ascending: true, nullsFirst: false });

        if (balanceError) {
          console.error(`  ❌ Error หา balance สำหรับ ${item.sku_id}:`, balanceError.message);
          errorCount++;
          continue;
        }

        if (!balances || balances.length === 0) {
          console.log(`  ⚠️  ไม่พบสต็อกสำหรับ ${item.sku_id} ที่ ${item.source_location_id}`);
          errorCount++;
          continue;
        }

        let remainingQty = item.quantity_to_pick;
        let reservationCreated = 0;

        // 3.2 จองสต็อกจาก balance (FEFO)
        for (const balance of balances) {
          if (remainingQty <= 0) break;

          const availableQty = balance.total_piece_qty - balance.reserved_piece_qty;
          if (availableQty <= 0) continue;

          const reserveQty = Math.min(remainingQty, availableQty);

          // สร้าง reservation record
          const { error: reserveError } = await supabase
            .from('picklist_item_reservations')
            .insert({
              picklist_item_id: item.id,
              balance_id: balance.balance_id,
              reserved_piece_qty: reserveQty,
              status: 'reserved'
              // reserved_by จะเป็น NULL (ระบบสร้างอัตโนมัติ)
            });

          if (reserveError) {
            console.error(`  ❌ Error สร้าง reservation:`, reserveError.message);
            errorCount++;
            continue;
          }

          // อัปเดต reserved_qty ใน balance
          const { error: updateError } = await supabase
            .from('wms_inventory_balances')
            .update({
              reserved_piece_qty: balance.reserved_piece_qty + reserveQty,
              updated_at: new Date().toISOString()
            })
            .eq('balance_id', balance.balance_id);

          if (updateError) {
            console.error(`  ❌ Error อัปเดต balance:`, updateError.message);
            errorCount++;
            continue;
          }

          remainingQty -= reserveQty;
          reservationCreated++;
        }

        if (remainingQty > 0) {
          console.log(`  ⚠️  จองไม่ครบสำหรับ ${item.sku_id}: ขาด ${remainingQty} ชิ้น`);
          errorCount++;
        } else {
          console.log(`  ✅ จองสำเร็จ ${item.sku_id}: ${item.quantity_to_pick} ชิ้น (${reservationCreated} records)`);
          successCount++;
        }
      }

      console.log(`\n📊 สรุป ${picklist.picklist_code}:`);
      console.log(`  - สำเร็จ: ${successCount} รายการ`);
      console.log(`  - ล้มเหลว: ${errorCount} รายการ`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ เสร็จสิ้นการสร้างยอดจองใหม่');
    console.log(`${'='.repeat(80)}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

recreatePicklistReservations();
