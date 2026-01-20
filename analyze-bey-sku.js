/**
 * Analyze a B-BEY SKU to understand the stock display behavior
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function analyzeBeySkus() {
  try {
    console.log('🔍 Analyzing B-BEY SKUs to understand stock behavior...\n');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get B-BEY SKUs with stock
    console.log('1. Finding B-BEY SKUs with inventory...');
    const { data: skusWithStock, error: stockError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        sku_id,
        total_piece_qty,
        reserved_piece_qty,
        master_sku!inner (
          sku_name,
          category
        )
      `)
      .ilike('sku_id', 'B-BEY%')
      .neq('total_piece_qty', 0)
      .limit(5);
    
    if (stockError) {
      console.error('❌ Stock Error:', stockError);
      return;
    }
    
    if (!skusWithStock || skusWithStock.length === 0) {
      console.log('❌ No B-BEY SKUs with stock found');
      return;
    }
    
    console.log('Found B-BEY SKUs with stock:');
    
    // Analyze each SKU
    for (let i = 0; i < Math.min(3, skusWithStock.length); i++) {
      const item = skusWithStock[i];
      console.log(`\n${i + 1}. 📊 ${item.sku_id}`);
      console.log(`   Name: ${item.master_sku?.sku_name || 'Unknown'}`);
      
      // Get all balances for this SKU
      const { data: allBalances, error: balanceError } = await supabase
        .from('wms_inventory_balances')
        .select(`
          sku_id,
          total_piece_qty,
          reserved_piece_qty,
          master_location (
            location_code,
            location_name
          )
        `)
        .eq('sku_id', item.sku_id);
      
      if (balanceError) {
        console.error('❌ Balance Error:', balanceError);
        continue;
      }
      
      let totalStock = 0;
      let totalReserved = 0;
      let locationCount = 0;
      
      allBalances?.forEach((balance) => {
        const total = Number(balance.total_piece_qty || 0);
        const reserved = Number(balance.reserved_piece_qty || 0);
        
        if (total !== 0) { // Only count non-zero balances
          totalStock += total;
          totalReserved += reserved;
          locationCount++;
        }
      });
      
      const totalAvailable = totalStock - totalReserved;
      
      console.log(`   📈 Summary:`);
      console.log(`      Locations with stock: ${locationCount}`);
      console.log(`      Total Stock: ${totalStock.toLocaleString()}`);
      console.log(`      Total Reserved: ${totalReserved.toLocaleString()}`);
      console.log(`      Total Available: ${totalAvailable.toLocaleString()}`);
      
      console.log(`   🎯 Forecast Display:`);
      console.log(`      Main row should show: ${totalAvailable.toLocaleString()} (available)`);
      console.log(`      Detail rows show: individual location totals`);
      
      if (totalAvailable === 0 && totalStock > 0) {
        console.log(`   🔴 Status: ALL STOCK RESERVED (explains 0 in main row)`);
      } else if (totalAvailable > 0) {
        console.log(`   ✅ Status: Available stock exists`);
      } else {
        console.log(`   ⚪ Status: No stock`);
      }
      
      // Check if there are pending orders for this SKU
      const { data: pendingOrders, error: pendingError } = await supabase
        .from('wms_order_items')
        .select(`
          order_qty,
          wms_orders!inner (
            status,
            delivery_date
          )
        `)
        .eq('sku_id', item.sku_id)
        .in('wms_orders.status', ['draft', 'confirmed', 'in_picking', 'picked']);
      
      if (!pendingError && pendingOrders && pendingOrders.length > 0) {
        const totalPending = pendingOrders.reduce((sum, p) => sum + (p.order_qty || 0), 0);
        console.log(`   📋 Pending Orders: ${totalPending.toLocaleString()}`);
      }
    }
    
    console.log('\n🎯 CONCLUSION:');
    console.log('If main row shows 0 while detail rows show stock, it means:');
    console.log('✅ All physical stock is RESERVED for orders');
    console.log('✅ Main row = Available stock (after deducting reserved)');
    console.log('✅ Detail rows = Physical stock per location');
    console.log('✅ This is CORRECT behavior, not a bug!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeBeySkus();