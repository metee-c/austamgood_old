/**
 * ตรวจสอบ loadlist LD-20260218-0018 ที่มีปัญหาสต็อคไม่พอ
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLoadlist() {
  console.log('🔍 ตรวจสอบ loadlist LD-20260218-0018\n');

  // 1. ดึงข้อมูล loadlist
  const { data: loadlist, error: loadlistError } = await supabase
    .from('loadlists')
    .select(`
      *,
      loadlist_items (
        id,
        order_id,
        sequence_no,
        wms_orders!inner (
          order_no,
          wms_order_items (
            sku_id,
            order_qty
          )
        )
      )
    `)
    .eq('loadlist_code', 'LD-20260218-0018')
    .single();

  if (loadlistError || !loadlist) {
    console.error('❌ ไม่พบ loadlist:', loadlistError);
    return;
  }

  console.log('📦 Loadlist:', loadlist.loadlist_code);
  console.log('   Status:', loadlist.status);
  console.log('   Warehouse:', loadlist.warehouse_id);
  console.log('   Items:', loadlist.loadlist_items?.length || 0);
  console.log('');

  // 2. ตรวจสอบสต็อคแต่ละรายการ
  console.log('📊 ตรวจสอบสต็อคแต่ละรายการ:\n');

  // รวม SKU จาก order_items
  const skuMap = new Map();
  
  for (const loadlistItem of loadlist.loadlist_items || []) {
    const order = loadlistItem.wms_orders;
    if (!order || !order.wms_order_items) continue;

    for (const orderItem of order.wms_order_items) {
      const existing = skuMap.get(orderItem.sku_id) || { quantity: 0, orders: [] };
      existing.quantity += orderItem.order_qty;
      existing.orders.push(order.order_no);
      skuMap.set(orderItem.sku_id, existing);
    }
  }

  console.log(`รวม SKU ทั้งหมด: ${skuMap.size} รายการ\n`);

  for (const [skuId, data] of skuMap.entries()) {
    // ดึงข้อมูล SKU
    const { data: sku } = await supabase
      .from('master_sku')
      .select('sku_name, qty_per_pack')
      .eq('sku_id', skuId)
      .single();

    const skuName = sku?.sku_name || skuId;
    console.log(`SKU: ${skuId}`);
    console.log(`  ชื่อ: ${skuName}`);
    console.log(`  จำนวนที่ต้องการ: ${data.quantity} ชิ้น`);
    console.log(`  จาก orders: ${data.orders.join(', ')}`);

    // ตรวจสอบสต็อคที่ Dispatch
    const { data: dispatchStock } = await supabase
      .from('wms_inventory_balances')
      .select('location_id, total_piece_qty, reserved_piece_qty, pallet_id')
      .eq('warehouse_id', loadlist.warehouse_id)
      .eq('sku_id', skuId)
      .eq('location_id', 'Dispatch');

    const totalDispatch = dispatchStock?.reduce((sum, b) => sum + (b.total_piece_qty || 0), 0) || 0;
    const reservedDispatch = dispatchStock?.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0) || 0;
    const availableDispatch = totalDispatch - reservedDispatch;

    console.log(`  สต็อคที่ Dispatch: ${totalDispatch} ชิ้น (available: ${availableDispatch})`);

    // ตรวจสอบสต็อคที่ Staging
    const { data: stagingStock } = await supabase
      .from('wms_inventory_balances')
      .select('location_id, total_piece_qty, reserved_piece_qty, pallet_id')
      .eq('warehouse_id', loadlist.warehouse_id)
      .eq('sku_id', skuId)
      .eq('location_id', 'Staging');

    const totalStaging = stagingStock?.reduce((sum, b) => sum + (b.total_piece_qty || 0), 0) || 0;
    const reservedStaging = stagingStock?.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0) || 0;
    const availableStaging = totalStaging - reservedStaging;

    console.log(`  สต็อคที่ Staging: ${totalStaging} ชิ้น (available: ${availableStaging})`);

    // สรุป
    const totalAvailable = availableDispatch + availableStaging;
    const shortage = data.quantity - totalAvailable;

    if (shortage > 0) {
      console.log(`  ⚠️ สต็อคไม่พอ: ขาดอีก ${shortage} ชิ้น`);
    } else {
      console.log(`  ✅ สต็อคพอ`);
    }

    console.log('');
  }

  // 3. ตรวจสอบ related bonus loadlists
  const { data: relatedBonusLoadlists } = await supabase
    .from('loadlists')
    .select(`
      loadlist_code,
      status,
      loadlist_items (
        sku_id,
        quantity
      )
    `)
    .eq('warehouse_id', loadlist.warehouse_id)
    .eq('status', 'pending')
    .like('loadlist_code', 'LD-%-BFS');

  if (relatedBonusLoadlists && relatedBonusLoadlists.length > 0) {
    console.log('🎁 Related Bonus Loadlists (pending):');
    for (const bl of relatedBonusLoadlists) {
      console.log(`  - ${bl.loadlist_code}: ${bl.loadlist_items?.length || 0} items`);
    }
    console.log('');
  }
}

checkLoadlist().catch(console.error);
