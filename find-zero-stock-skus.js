/**
 * Find SKUs that actually have 0 available stock but have pending orders
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function findZeroStockSkus() {
  try {
    console.log('🔍 Finding SKUs with 0 available stock but have pending orders...\n');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Get all finished goods SKUs
    console.log('1. Getting all finished goods SKUs...');
    const { data: skus, error: skuError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, category')
      .eq('category', 'สินค้าสำเร็จรูป')
      .eq('status', 'active')
      .limit(100); // Limit for performance
    
    if (skuError) {
      console.error('❌ SKU Error:', skuError);
      return;
    }
    
    console.log(`Found ${skus?.length || 0} finished goods SKUs`);
    
    if (!skus || skus.length === 0) {
      console.log('❌ No SKUs found');
      return;
    }
    
    const skuIds = skus.map(s => s.sku_id);
    
    // 2. Get inventory balances for all SKUs
    console.log('\n2. Getting inventory balances...');
    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select('sku_id, total_piece_qty, reserved_piece_qty')
      .in('sku_id', skuIds);
    
    if (balanceError) {
      console.error('❌ Balance Error:', balanceError);
      return;
    }
    
    // Calculate stock by SKU
    const stockBySkuId = {};
    (balances || []).forEach(b => {
      const totalQty = Number(b.total_piece_qty || 0);
      const reservedQty = Number(b.reserved_piece_qty || 0);
      const availableQty = totalQty - reservedQty;
      
      if (!stockBySkuId[b.sku_id]) {
        stockBySkuId[b.sku_id] = { total: 0, reserved: 0, available: 0 };
      }
      stockBySkuId[b.sku_id].total += totalQty;
      stockBySkuId[b.sku_id].reserved += reservedQty;
      stockBySkuId[b.sku_id].available += availableQty;
    });
    
    // 3. Get pending orders
    console.log('\n3. Getting pending orders...');
    const pendingStatuses = ['draft', 'confirmed', 'in_picking', 'picked'];
    
    const { data: pendingOrderItems, error: pendingError } = await supabase
      .from('wms_order_items')
      .select(`
        sku_id,
        order_qty,
        wms_orders!inner (
          status
        )
      `)
      .in('sku_id', skuIds)
      .in('wms_orders.status', pendingStatuses);
    
    if (pendingError) {
      console.error('❌ Pending Error:', pendingError);
      return;
    }
    
    // Calculate pending by SKU
    const pendingBySkuId = {};
    (pendingOrderItems || []).forEach(item => {
      const qty = Number(item.order_qty || 0);
      pendingBySkuId[item.sku_id] = (pendingBySkuId[item.sku_id] || 0) + qty;
    });
    
    // 4. Find problematic SKUs
    console.log('\n4. Analyzing SKUs...');
    
    const problematicSkus = [];
    
    skus.forEach(sku => {
      const stock = stockBySkuId[sku.sku_id] || { total: 0, reserved: 0, available: 0 };
      const pending = pendingBySkuId[sku.sku_id] || 0;
      
      // Look for SKUs with 0 available stock but have pending orders
      if (stock.available === 0 && pending > 0) {
        problematicSkus.push({
          skuId: sku.sku_id,
          skuName: sku.sku_name,
          totalStock: stock.total,
          reservedStock: stock.reserved,
          availableStock: stock.available,
          pendingOrders: pending,
          overReserved: stock.reserved - pending
        });
      }
    });
    
    console.log(`Found ${problematicSkus.length} SKUs with 0 available stock but have pending orders:`);
    
    if (problematicSkus.length === 0) {
      console.log('\n🤔 No SKUs found with 0 available stock and pending orders');
      console.log('This suggests the issue might be:');
      console.log('1. Frontend caching/display issue');
      console.log('2. Different data between what user sees and current database state');
      console.log('3. Timing issue - data changed since user reported the problem');
      
      // Show some examples of SKUs with pending orders
      console.log('\n📊 Examples of SKUs with pending orders:');
      const skusWithPending = [];
      skus.forEach(sku => {
        const stock = stockBySkuId[sku.sku_id] || { total: 0, reserved: 0, available: 0 };
        const pending = pendingBySkuId[sku.sku_id] || 0;
        if (pending > 0) {
          skusWithPending.push({
            skuId: sku.sku_id,
            skuName: sku.sku_name,
            availableStock: stock.available,
            pendingOrders: pending
          });
        }
      });
      
      skusWithPending.slice(0, 5).forEach((sku, index) => {
        console.log(`${index + 1}. ${sku.skuId}`);
        console.log(`   Name: ${sku.skuName}`);
        console.log(`   Available: ${sku.availableStock.toLocaleString()}`);
        console.log(`   Pending: ${sku.pendingOrders.toLocaleString()}`);
      });
      
    } else {
      // Show problematic SKUs
      problematicSkus.slice(0, 10).forEach((sku, index) => {
        console.log(`\n${index + 1}. ${sku.skuId} - ${sku.skuName}`);
        console.log(`   Total Stock: ${sku.totalStock.toLocaleString()}`);
        console.log(`   Reserved: ${sku.reservedStock.toLocaleString()}`);
        console.log(`   Available: ${sku.availableStock.toLocaleString()}`);
        console.log(`   Pending Orders: ${sku.pendingOrders.toLocaleString()}`);
        
        if (sku.overReserved > 0) {
          console.log(`   🔴 Over-reserved by: ${sku.overReserved.toLocaleString()}`);
        } else if (sku.overReserved === 0) {
          console.log(`   ⚠️  Exactly reserved for pending orders`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findZeroStockSkus();