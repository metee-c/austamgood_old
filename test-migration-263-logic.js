require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('🧪 Testing Migration 263 Logic (Dry Run)...\n');
    
    // Get orders for testing
    const { data: orders, error: ordersError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, customer_id')
      .eq('order_type', 'express')
      .eq('delivery_date', '2026-01-20')
      .in('status', ['draft', 'confirmed']);
    
    if (ordersError) throw ordersError;
    
    if (!orders || orders.length === 0) {
      console.log('❌ No orders found for 2026-01-20');
      return;
    }
    
    console.log(`📋 Found ${orders.length} orders\n`);
    
    // Get order items
    const orderIds = orders.map(o => o.order_id);
    const { data: orderItems } = await supabase
      .from('wms_order_items')
      .select('order_id, order_item_id, sku_id, order_qty')
      .in('order_id', orderIds);
    
    // Get SKU info
    const skuIds = [...new Set(orderItems.map(i => i.sku_id))];
    const { data: skus } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, qty_per_pack, weight_per_pack_kg')
      .in('sku_id', skuIds);
    
    const skuMap = new Map(skus.map(s => [s.sku_id, s]));
    
    let totalPacks = 0;
    let totalItems = 0;
    
    console.log('Order | SKU | Order Qty | Qty/Pack | Packs Needed');
    console.log('─'.repeat(80));
    
    const orderMap = new Map(orders.map(o => [o.order_id, o]));
    
    orderItems.slice(0, 10).forEach(item => {
      const order = orderMap.get(item.order_id);
      const sku = skuMap.get(item.sku_id);
      const qtyPerPack = sku?.qty_per_pack || 1;
      const packsNeeded = Math.ceil(item.order_qty / qtyPerPack);
      
      console.log(
        `${(order?.order_no || '').padEnd(15)} | ` +
        `${item.sku_id.padEnd(20)} | ` +
        `${item.order_qty.toString().padEnd(9)} | ` +
        `${qtyPerPack.toString().padEnd(8)} | ` +
        `${packsNeeded}`
      );
    });
    
    if (orderItems.length > 10) {
      console.log(`... (showing first 10 of ${orderItems.length} items)`);
    }
    
    // Calculate totals
    orderItems.forEach(item => {
      const sku = skuMap.get(item.sku_id);
      const qtyPerPack = sku?.qty_per_pack || 1;
      const packsNeeded = Math.ceil(item.order_qty / qtyPerPack);
      totalPacks += packsNeeded;
      totalItems++;
    });
    
    console.log('─'.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`  Total Orders: ${orders.length}`);
    console.log(`  Total Order Items: ${totalItems}`);
    console.log(`  Total Packs (NEW LOGIC): ${totalPacks}`);
    console.log(`  Old Logic Would Create: ${totalItems} packages`);
    console.log(`  Difference: +${totalPacks - totalItems} packages\n`);
    
    if (totalPacks === 164) {
      console.log('✅✅✅ PERFECT! New logic will create exactly 164 packages as expected!');
    } else {
      console.log(`⚠️  Expected 164 packages, but calculation shows ${totalPacks}`);
      console.log(`   Difference: ${164 - totalPacks} packages`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
})();
