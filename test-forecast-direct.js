/**
 * Test the forecast logic directly by calling the database function
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testForecastDirect() {
  try {
    console.log('🧪 Testing forecast logic directly for SKU B-BEY-D|MNB|010...\n');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const targetSkuId = 'B-BEY-D|MNB|010';
    
    // 1. Get SKU info
    console.log('1. Getting SKU info...');
    const { data: sku, error: skuError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, category, sub_category, brand, qty_per_pack, safety_stock, reorder_point')
      .eq('sku_id', targetSkuId)
      .single();
    
    if (skuError) {
      console.error('❌ SKU Error:', skuError);
      return;
    }
    
    if (!sku) {
      console.error('❌ SKU not found');
      return;
    }
    
    console.log('✅ SKU found:', sku.sku_name);
    
    // 2. Get inventory balances
    console.log('\n2. Getting inventory balances...');
    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select('sku_id, total_piece_qty, reserved_piece_qty')
      .eq('sku_id', targetSkuId);
    
    if (balanceError) {
      console.error('❌ Balance Error:', balanceError);
      return;
    }
    
    // Calculate stock totals
    let totalStock = 0;
    let totalReserved = 0;
    
    (balances || []).forEach(b => {
      const total = Number(b.total_piece_qty || 0);
      const reserved = Number(b.reserved_piece_qty || 0);
      totalStock += total;
      totalReserved += reserved;
    });
    
    const availableStockFromBalance = totalStock - totalReserved;
    
    console.log('📊 Balance Summary:');
    console.log('   Total Stock:', totalStock.toLocaleString());
    console.log('   Total Reserved:', totalReserved.toLocaleString());
    console.log('   Available Stock (total - reserved):', availableStockFromBalance.toLocaleString());
    
    // 3. Get pending orders
    console.log('\n3. Getting pending orders...');
    const pendingStatuses = ['draft', 'confirmed', 'in_picking', 'picked'];
    
    const { data: pendingOrderItems, error: pendingError } = await supabase
      .from('wms_order_items')
      .select(`
        sku_id,
        order_qty,
        picked_qty,
        wms_orders!inner (
          status,
          delivery_date
        )
      `)
      .eq('sku_id', targetSkuId)
      .in('wms_orders.status', pendingStatuses);
    
    if (pendingError) {
      console.error('❌ Pending Error:', pendingError);
      return;
    }
    
    let pendingOrderQty = 0;
    (pendingOrderItems || []).forEach(item => {
      const qty = Number(item.order_qty || 0);
      pendingOrderQty += qty;
    });
    
    console.log('📋 Pending Orders:', pendingOrderQty.toLocaleString());
    
    // 4. Calculate what should be displayed
    console.log('\n4. Forecast Logic Analysis:');
    console.log('   Backend returns total_stock =', availableStockFromBalance.toLocaleString(), '(available stock from balance)');
    console.log('   Backend returns pending_order_qty =', pendingOrderQty.toLocaleString());
    
    // Check if this matches the user's issue
    if (availableStockFromBalance === 0 && pendingOrderQty === 210) {
      console.log('\n🎯 PROBLEM CONFIRMED:');
      console.log('✅ Available stock from balance: 0');
      console.log('✅ Pending orders: 210');
      console.log('✅ This matches user description!');
      
      // Analyze why available stock is 0
      if (totalReserved > pendingOrderQty) {
        console.log('\n🔴 ROOT CAUSE: OVER-RESERVATION');
        console.log('   Reserved qty:', totalReserved.toLocaleString());
        console.log('   Actual pending:', pendingOrderQty.toLocaleString());
        console.log('   Over-reserved by:', (totalReserved - pendingOrderQty).toLocaleString());
        console.log('   This causes available stock to show 0 incorrectly');
      } else if (totalReserved === pendingOrderQty) {
        console.log('\n⚠️  EXACT RESERVATION MATCH');
        console.log('   All stock is reserved for pending orders');
        console.log('   But user expects to see available stock');
      }
    } else {
      console.log('\n🤔 UNEXPECTED RESULT:');
      console.log('   Expected: available=0, pending=210');
      console.log('   Actual: available=' + availableStockFromBalance + ', pending=' + pendingOrderQty);
    }
    
    // 5. Show what the detail rows would display
    console.log('\n5. Detail Row Analysis:');
    console.log('   Detail rows show individual location balances:');
    (balances || []).slice(0, 3).forEach((balance, index) => {
      const total = Number(balance.total_piece_qty || 0);
      const reserved = Number(balance.reserved_piece_qty || 0);
      const available = total - reserved;
      console.log(`   Location ${index + 1}: Total=${total}, Reserved=${reserved}, Available=${available}`);
    });
    
    if (balances && balances.length > 3) {
      console.log(`   ... and ${balances.length - 3} more locations`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testForecastDirect();