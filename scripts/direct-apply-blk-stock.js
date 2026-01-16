require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SYSTEM_USER_ID = '1';
const WAREHOUSE_ID = 'WH001';

async function main() {
  console.log('=== Direct Apply BLK Stock Adjustments ===\n');

  // 1. อ่านไฟล์ adjustments
  console.log('1. อ่านไฟล์ blk-stock-adjustments.json...');
  const adjustments = JSON.parse(fs.readFileSync('blk-stock-adjustments.json', 'utf8'));
  console.log(`   พบ ${adjustments.length} รายการที่ต้องปรับปรุง\n`);

  let successCount = 0;
  let failCount = 0;

  // 2. ประมวลผลแต่ละรายการ
  for (const adj of adjustments) {
    try {
      if (adj.type === 'REMOVE') {
        // ลบสต็อก - ลบ balance record
        console.log(`➖ ลบ: ${adj.locationId} | ${adj.palletId} (${adj.skuId}) = ${adj.qty} ชิ้น`);
        
        const { error: deleteError } = await supabase
          .from('wms_inventory_balances')
          .delete()
          .eq('location_id', adj.locationId)
          .eq('pallet_id', adj.palletId)
          .eq('sku_id', adj.skuId);

        if (deleteError) {
          console.error(`   ❌ Error:`, deleteError.message);
          failCount++;
          continue;
        }

        // บันทึก ledger
        await supabase.from('wms_inventory_ledger').insert({
          warehouse_id: WAREHOUSE_ID,
          location_id: adj.locationId,
          sku_id: adj.skuId,
          pallet_id: adj.palletId,
          lot_no: adj.lotNo,
          transaction_type: 'adjustment_out',
          pack_qty: 0,
          piece_qty: -adj.qty,
          reference_type: 'physical_count',
          reference_id: 'BLK-COUNT-2026-01-16',
          remarks: 'Physical count adjustment - item not found',
          created_by: SYSTEM_USER_ID
        });

        console.log(`   ✅ ลบสำเร็จ`);
        successCount++;

      } else if (adj.type === 'ADD') {
        // เพิ่มสต็อก - สร้าง balance record ใหม่
        console.log(`➕ เพิ่ม: ${adj.locationId} | ${adj.palletId} (${adj.skuId}) = ${adj.qty} ชิ้น`);

        // ตรวจสอบว่ามี balance อยู่แล้วหรือไม่
        const { data: existing } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id')
          .eq('location_id', adj.locationId)
          .eq('pallet_id', adj.palletId)
          .eq('sku_id', adj.skuId)
          .single();

        if (existing) {
          console.log(`   ⚠️  มี balance อยู่แล้ว ข้าม`);
          continue;
        }

        const { error: insertError } = await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: WAREHOUSE_ID,
            location_id: adj.locationId,
            sku_id: adj.skuId,
            pallet_id: adj.palletId,
            lot_no: adj.lotNo,
            production_date: adj.productionDate,
            expiry_date: adj.expiryDate,
            total_pack_qty: 0,
            total_piece_qty: adj.qty,
            reserved_pack_qty: 0,
            reserved_piece_qty: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`   ❌ Error:`, insertError.message);
          failCount++;
          continue;
        }

        // บันทึก ledger
        await supabase.from('wms_inventory_ledger').insert({
          warehouse_id: WAREHOUSE_ID,
          location_id: adj.locationId,
          sku_id: adj.skuId,
          pallet_id: adj.palletId,
          lot_no: adj.lotNo,
          production_date: adj.productionDate,
          expiry_date: adj.expiryDate,
          transaction_type: 'adjustment_in',
          pack_qty: 0,
          piece_qty: adj.qty,
          reference_type: 'physical_count',
          reference_id: 'BLK-COUNT-2026-01-16',
          remarks: 'Physical count adjustment - new item found',
          created_by: SYSTEM_USER_ID
        });

        console.log(`   ✅ เพิ่มสำเร็จ`);
        successCount++;

      } else if (adj.type === 'ADJUST') {
        // ปรับจำนวน - update balance record
        console.log(`🔄 ปรับ: ${adj.locationId} | ${adj.palletId} (${adj.skuId}) จาก ${adj.oldQty} เป็น ${adj.newQty} (${adj.diff > 0 ? '+' : ''}${adj.diff})`);

        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: adj.newQty,
            updated_at: new Date().toISOString()
          })
          .eq('balance_id', adj.balanceId);

        if (updateError) {
          console.error(`   ❌ Error:`, updateError.message);
          failCount++;
          continue;
        }

        // บันทึก ledger
        await supabase.from('wms_inventory_ledger').insert({
          warehouse_id: WAREHOUSE_ID,
          location_id: adj.locationId,
          sku_id: adj.skuId,
          pallet_id: adj.palletId,
          lot_no: adj.lotNo,
          production_date: adj.productionDate,
          expiry_date: adj.expiryDate,
          transaction_type: adj.diff > 0 ? 'adjustment_in' : 'adjustment_out',
          pack_qty: 0,
          piece_qty: adj.diff,
          reference_type: 'physical_count',
          reference_id: 'BLK-COUNT-2026-01-16',
          remarks: `Physical count adjustment - quantity difference`,
          created_by: SYSTEM_USER_ID
        });

        console.log(`   ✅ ปรับสำเร็จ`);
        successCount++;
      }

    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
      failCount++;
    }
  }

  // 3. สรุปผล
  console.log('\n\n=== สรุปผลการปรับปรุง ===');
  console.log(`สำเร็จ: ${successCount} รายการ`);
  console.log(`ล้มเหลว: ${failCount} รายการ`);
  console.log(`\n✅ เสร็จสิ้น!`);
  console.log(`\n📝 หมายเหตุ:`);
  console.log(`- ตรวจสอบสต็อกที่หน้า http://localhost:3000/warehouse/inventory-balances`);
  console.log(`- ตรวจสอบ Inventory Ledger ที่หน้า http://localhost:3000/warehouse/inventory-ledger`);
}

main().catch(console.error);
