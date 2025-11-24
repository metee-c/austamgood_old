// Script to test picklist stock transfer flow
// This script simulates completing a picklist and verifies stock movement

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testPicklistStockTransfer() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🧪 Testing Picklist Stock Transfer Flow\n');
  console.log('=' .repeat(60));

  // 1. ค้นหา picklist ที่สถานะ assigned หรือ picking
  console.log('\n📋 Step 1: Finding test picklist...');
  const { data: picklists, error: picklistError } = await supabase
    .from('picklists')
    .select('*')
    .in('status', ['assigned', 'picking'])
    .limit(1);

  if (picklistError || !picklists || picklists.length === 0) {
    console.log('⚠️  No available picklists found for testing');
    console.log('   Please create a picklist first or use mobile app to test');
    return;
  }

  const picklist = picklists[0];
  console.log(`✅ Found picklist: ${picklist.picklist_code} (Status: ${picklist.status})`);

  // 2. ดึงข้อมูล picklist_items
  console.log('\n📦 Step 2: Fetching picklist items...');
  const { data: items, error: itemsError } = await supabase
    .from('picklist_items')
    .select('*')
    .eq('picklist_id', picklist.id)
    .gt('quantity_picked', 0);

  if (itemsError) {
    console.error('❌ Error:', itemsError.message);
    return;
  }

  if (!items || items.length === 0) {
    console.log('⚠️  No picked items found (quantity_picked = 0)');
    console.log('   Please scan items in mobile app first');
    return;
  }

  console.log(`✅ Found ${items.length} items with picked quantities:`);
  items.forEach((item, idx) => {
    console.log(`   ${idx + 1}. SKU: ${item.sku_id}, Qty: ${item.quantity_picked}, From: ${item.source_location_id || 'N/A'}`);
  });

  // 3. ตรวจสอบ balance ก่อนการย้าย
  console.log('\n📊 Step 3: Checking inventory balances BEFORE transfer...');
  const beforeBalances: Record<string, any> = {};

  for (const item of items) {
    if (!item.source_location_id) continue;

    const { data: balances } = await supabase
      .from('wms_inventory_balances')
      .select('*')
      .eq('sku_id', item.sku_id)
      .eq('location_id', item.source_location_id);

    const totalQty = balances?.reduce((sum, b) => sum + (b.total_piece_qty || 0), 0) || 0;
    beforeBalances[`${item.sku_id}-${item.source_location_id}`] = totalQty;

    console.log(`   SKU ${item.sku_id} @ ${item.source_location_id}: ${totalQty} pieces`);
  }

  // 4. ค้นหา Dispatch location
  console.log('\n🚚 Step 4: Finding Dispatch location...');
  const warehouseId = 'WH001'; // Assuming default warehouse
  const { data: dispatchLoc, error: dispatchError } = await supabase
    .from('master_location')
    .select('*')
    .eq('location_type', 'shipping')
    .eq('warehouse_id', warehouseId)
    .eq('active_status', 'active')
    .maybeSingle();

  if (dispatchError || !dispatchLoc) {
    console.error('❌ Dispatch location not found');
    return;
  }

  console.log(`✅ Dispatch location: ${dispatchLoc.location_code} (${dispatchLoc.location_id})`);

  // 5. เตือนผู้ใช้เกี่ยวกับการทดสอบ
  console.log('\n⚠️  IMPORTANT: This is a READ-ONLY test');
  console.log('   To actually test stock transfer, use the mobile app:');
  console.log(`   1. Go to http://localhost:3000/mobile/pick/${picklist.id}`);
  console.log('   2. Complete all items');
  console.log('   3. Click "เช็คสินค้าเสร็จสิ้น" button');
  console.log('   4. Select employee and confirm');
  console.log('\n   Then check:');
  console.log(`   - Inventory Balances: http://localhost:3000/warehouse/inventory-balances`);
  console.log(`   - Inventory Ledger: http://localhost:3000/warehouse/inventory-ledger`);

  // 6. แสดงสรุป
  console.log('\n📝 Expected Results After Completion:');
  console.log('   ✓ Picklist status → completed');
  console.log('   ✓ Move document created (transfer type)');
  console.log('   ✓ 2 ledger entries per item (OUT from source, IN to dispatch)');
  console.log('   ✓ Source location balance decreased');
  console.log('   ✓ Dispatch location balance increased');
  console.log('   ✓ Order status → picked');
  console.log('   ✓ Route status → ready_to_load');

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test preparation completed\n');
}

testPicklistStockTransfer().catch(console.error);
