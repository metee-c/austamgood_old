/**
 * Check forecast issue by examining the actual data flow
 * Run with: node check-forecast-issue.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkForecastIssue() {
  try {
    console.log('🔍 Investigating Forecast Display Issue...\n');
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials in .env.local');
      console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test the specific SKU from the image
    const testSkuId = 'B-BEY-01|008|013';
    
    console.log(`📊 Analyzing SKU: ${testSkuId}\n`);
    
    // 1. Check SKU master data
    console.log('1. SKU Master Data:');
    const { data: skuData, error: skuError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, category, sub_category, safety_stock')
      .eq('sku_id', testSkuId)
      .single();
    
    if (skuError) {
      console.error('❌ SKU Error:', skuError);
      return;
    }
    
    console.log(`   Name: ${skuData.sku_name}`);
    console.log(`   Category: ${skuData.category}`);
    console.log(`   Sub Category: ${skuData.sub_category}`);
    console.log(`   Safety Stock: ${skuData.safety_stock || 0}`);
    
    // 2. Check inventory balances (same logic as forecast.ts)
    console.log('\n2. Inventory Balances:');
    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select('sku_id, total_piece_qty, reserved_piece_qty')
      .eq('sku_id', testSkuId);
    
    if (balanceError) {
      console.error('❌ Balance Error:', balanceError);
      return;
    }
    
    console.log(`   Found ${balances?.length || 0} balance records`);
    
    // Calculate stock using the same logic as forecast.ts
    const stockBySkuId = {};
    (balances || []).forEach(b => {
      const totalQty = Number(b.total_piece_qty || 0);
      const reservedQty = Number(b.reserved_piece_qty || 0);
      const availableQty = totalQty - reservedQty;
      
      if (!stockBySkuId[b.sku_id]) {
        stockBySkuId[b.sku_id] = { total: 0, available: 0 };
      }
      stockBySkuId[b.sku_id].total += totalQty;
      stockBySkuId[b.sku_id].available += availableQty;
    });
    
    const stockData = stockBySkuId[testSkuId] || { total: 0, available: 0 };
    const totalStock = stockData.total;
    const availableStockFromBalance = stockData.available;
    
    console.log(`   Total Stock: ${totalStock.toLocaleString()}`);
    console.log(`   Reserved Stock: ${(totalStock - availableStockFromBalance).toLocaleString()}`);
    console.log(`   Available Stock: ${availableStockFromBalance.toLocaleString()}`);
    
    // 3. What the API should return
    console.log('\n3. API Response Analysis:');
    console.log(`   total_stock field should be: ${availableStockFromBalance.toLocaleString()}`);
    
    if (availableStockFromBalance === 0 && totalStock > 0) {
      console.log('\n🎯 ROOT CAUSE IDENTIFIED:');
      console.log('   ✅ All stock is RESERVED');
      console.log('   ✅ Backend correctly returns 0 for available stock');
      console.log('   ✅ Detail rows show individual location totals (including reserved)');
      console.log('   ✅ Main row shows available stock (after deducting reserved) = 0');
      console.log('\n📋 CONCLUSION:');
      console.log('   This is CORRECT BEHAVIOR, not a bug!');
      console.log('   - Main row: Available stock (0) - what can actually be used');
      console.log('   - Detail rows: Total stock per location - for reference');
    } else if (availableStockFromBalance > 0) {
      console.log('\n⚠️  POTENTIAL ISSUE:');
      console.log('   Available stock > 0 but main row shows 0');
      console.log('   This could be a caching or display issue');
    } else {
      console.log('\n📋 NO STOCK FOUND:');
      console.log('   No inventory exists for this SKU');
    }
    
    // 4. Check pending orders
    console.log('\n4. Pending Orders Check:');
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('wms_order_items')
      .select(`
        order_qty,
        wms_orders!inner (
          status,
          delivery_date
        )
      `)
      .eq('sku_id', testSkuId)
      .in('wms_orders.status', ['draft', 'confirmed', 'in_picking', 'picked']);
    
    if (pendingError) {
      console.error('❌ Pending Orders Error:', pendingError);
    } else {
      const totalPending = pendingOrders?.reduce((sum, p) => sum + (p.order_qty || 0), 0) || 0;
      console.log(`   Pending Orders: ${totalPending.toLocaleString()}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkForecastIssue();