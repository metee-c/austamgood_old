require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SYSTEM_USER_ID = '1'; // System user for automated adjustments
const WAREHOUSE_ID = 'WH001';

async function main() {
  console.log('=== Apply BLK Stock Adjustments ===\n');

  // 1. อ่านไฟล์ adjustments
  console.log('1. อ่านไฟล์ blk-stock-adjustments.json...');
  const adjustments = JSON.parse(fs.readFileSync('blk-stock-adjustments.json', 'utf8'));
  console.log(`   พบ ${adjustments.length} รายการที่ต้องปรับปรุง\n`);

  // 2. จัดกลุ่มตามโลเคชั่น
  const byLocation = new Map();
  adjustments.forEach(adj => {
    if (!byLocation.has(adj.locationId)) {
      byLocation.set(adj.locationId, []);
    }
    byLocation.get(adj.locationId).push(adj);
  });

  console.log(`2. จัดกลุ่มเป็น ${byLocation.size} โลเคชั่น\n`);

  // 3. สร้าง Stock Adjustment Document สำหรับแต่ละโลเคชั่น
  let totalCreated = 0;
  let totalFailed = 0;

  for (const [locationId, locationAdjs] of byLocation.entries()) {
    console.log(`\n--- ${locationId} (${locationAdjs.length} รายการ) ---`);

    try {
      // สร้าง adjustment document
      const adjustmentDoc = {
        warehouse_id: WAREHOUSE_ID,
        location_id: locationId,
        adjustment_type: 'physical_count',
        reason: `Physical count - BLK Zone (${new Date().toISOString().split('T')[0]})`,
        status: 'draft',
        created_by: SYSTEM_USER_ID,
        updated_by: SYSTEM_USER_ID,
        remarks: `Auto-generated from BLK.xlsx physical count`
      };

      const { data: doc, error: docError } = await supabase
        .from('wms_stock_adjustments')
        .insert(adjustmentDoc)
        .select()
        .single();

      if (docError) {
        console.error(`   ❌ Error creating document:`, docError.message);
        totalFailed += locationAdjs.length;
        continue;
      }

      console.log(`   ✅ Created adjustment document: ${doc.adjustment_id}`);

      // สร้าง adjustment items
      const items = [];
      for (const adj of locationAdjs) {
        let item;
        
        if (adj.type === 'REMOVE') {
          // ลบสต็อก - ปรับเป็น 0
          item = {
            adjustment_id: doc.adjustment_id,
            sku_id: adj.skuId,
            pallet_id: adj.palletId,
            lot_no: adj.lotNo,
            location_id: locationId,
            system_qty: adj.qty,
            counted_qty: 0,
            difference_qty: -adj.qty,
            adjustment_qty: -adj.qty,
            reason: 'Not found in physical count',
            created_by: SYSTEM_USER_ID
          };
        } else if (adj.type === 'ADD') {
          // เพิ่มสต็อก - จาก 0 เป็นจำนวนที่นับได้
          item = {
            adjustment_id: doc.adjustment_id,
            sku_id: adj.skuId,
            pallet_id: adj.palletId,
            lot_no: adj.lotNo,
            production_date: adj.productionDate,
            expiry_date: adj.expiryDate,
            location_id: locationId,
            system_qty: 0,
            counted_qty: adj.qty,
            difference_qty: adj.qty,
            adjustment_qty: adj.qty,
            reason: 'Found in physical count',
            created_by: SYSTEM_USER_ID
          };
        } else if (adj.type === 'ADJUST') {
          // ปรับจำนวน
          item = {
            adjustment_id: doc.adjustment_id,
            sku_id: adj.skuId,
            pallet_id: adj.palletId,
            lot_no: adj.lotNo,
            production_date: adj.productionDate,
            expiry_date: adj.expiryDate,
            location_id: locationId,
            system_qty: adj.oldQty,
            counted_qty: adj.newQty,
            difference_qty: adj.diff,
            adjustment_qty: adj.diff,
            reason: 'Quantity difference in physical count',
            created_by: SYSTEM_USER_ID
          };
        }

        if (item) {
          items.push(item);
        }
      }

      // Insert items
      const { error: itemsError } = await supabase
        .from('wms_stock_adjustment_items')
        .insert(items);

      if (itemsError) {
        console.error(`   ❌ Error creating items:`, itemsError.message);
        totalFailed += locationAdjs.length;
        continue;
      }

      console.log(`   ✅ Created ${items.length} adjustment items`);

      // Submit และ Approve adjustment
      console.log(`   📝 Submitting adjustment...`);
      const { error: submitError } = await supabase
        .from('wms_stock_adjustments')
        .update({
          status: 'pending_approval',
          submitted_at: new Date().toISOString(),
          submitted_by: SYSTEM_USER_ID
        })
        .eq('adjustment_id', doc.adjustment_id);

      if (submitError) {
        console.error(`   ❌ Error submitting:`, submitError.message);
        totalFailed += locationAdjs.length;
        continue;
      }

      console.log(`   ✅ Submitted for approval`);

      // Auto-approve (เนื่องจากเป็นการนับจริง)
      console.log(`   ✅ Approving adjustment...`);
      const { error: approveError } = await supabase
        .from('wms_stock_adjustments')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: SYSTEM_USER_ID
        })
        .eq('adjustment_id', doc.adjustment_id);

      if (approveError) {
        console.error(`   ❌ Error approving:`, approveError.message);
        totalFailed += locationAdjs.length;
        continue;
      }

      console.log(`   ✅ Approved`);

      // Complete adjustment (apply to inventory)
      console.log(`   🔄 Completing adjustment (applying to inventory)...`);
      const { error: completeError } = await supabase
        .from('wms_stock_adjustments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: SYSTEM_USER_ID
        })
        .eq('adjustment_id', doc.adjustment_id);

      if (completeError) {
        console.error(`   ❌ Error completing:`, completeError.message);
        totalFailed += locationAdjs.length;
        continue;
      }

      console.log(`   ✅ Completed - inventory updated!`);
      totalCreated += locationAdjs.length;

    } catch (error) {
      console.error(`   ❌ Error processing location:`, error.message);
      totalFailed += locationAdjs.length;
    }
  }

  // 4. สรุปผล
  console.log('\n\n=== สรุปผลการปรับปรุง ===');
  console.log(`สำเร็จ: ${totalCreated} รายการ`);
  console.log(`ล้มเหลว: ${totalFailed} รายการ`);
  console.log(`\n✅ เสร็จสิ้น!`);
  console.log(`\n📝 หมายเหตุ:`);
  console.log(`- ตรวจสอบสต็อกที่หน้า http://localhost:3000/warehouse/inventory-balances`);
  console.log(`- ตรวจสอบ Stock Adjustments ที่หน้า http://localhost:3000/stock-management/adjustment`);
}

main().catch(console.error);
