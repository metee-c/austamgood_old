/**
 * Debug script to check the actual data being returned by the forecast API
 * This will help us understand why the main row shows 0 while detail rows show correct values
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-key';

async function debugForecastData() {
  try {
    console.log('🔍 Debugging Forecast Data...\n');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test the specific SKU that shows 0 in the main row
    const testSkuId = 'B-BEY-01|008|013'; // From the image
    
    console.log(`📊 Checking SKU: ${testSkuId}\n`);
    
    // 1. Check raw inventory balances
    console.log('1. Raw Inventory Balances:');
    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select('sku_id, location_id, total_piece_qty, reserved_piece_qty, master_location(location_code)')
      .eq('sku_id', testSkuId)
      .gt('total_piece_qty', 0);
    
    if (balanceError) {
      console.error('❌ Balance Error:', balanceError);
    } else {
      console.table(balances?.map(b => ({
        location: b.master_location?.location_code || 'Unknown',
        total: b.total_piece_qty,
        reserved: b.reserved_piece_qty || 0,
        available: b.total_piece_qty - (b.reserved_piece_qty || 0)
      })) || []);
      
      // Calculate totals
      const totalStock = balances?.reduce((sum, b) => sum + (b.total_piece_qty || 0), 0) || 0;
      const totalReserved = balances?.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0) || 0;
      const totalAvailable = totalStock - totalReserved;
      
      console.log(`\n📈 Summary for ${testSkuId}:`);
      console.log(`   Total Stock: ${totalStock.toLocaleString()}`);
      console.log(`   Total Reserved: ${totalReserved.toLocaleString()}`);
      console.log(`   Total Available: ${totalAvailable.toLocaleString()}`);
    }
    
    // 2. Check what the forecast function returns
    console.log('\n2. Testing Forecast Function Logic:');
    
    // Simulate the same logic as in lib/database/forecast.ts
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
    console.log(`   Calculated Stock Data:`, stockData);
    console.log(`   availableStockFromBalance: ${stockData.available}`);
    
    // 3. Check pending orders
    console.log('\n3. Pending Orders:');
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('wms_order_items')
      .select(`
        sku_id,
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
      console.table(pendingOrders?.map(p => ({
        qty: p.order_qty,
        status: p.wms_orders?.status,
        delivery_date: p.wms_orders?.delivery_date
      })) || []);
      
      const totalPending = pendingOrders?.reduce((sum, p) => sum + (p.order_qty || 0), 0) || 0;
      console.log(`   Total Pending: ${totalPending.toLocaleString()}`);
    }
    
    // 4. What should be returned as total_stock
    const expectedTotalStock = stockData.available; // This should be what's returned
    console.log(`\n🎯 Expected total_stock in API response: ${expectedTotalStock.toLocaleString()}`);
    
    if (expectedTotalStock === 0) {
      console.log('\n⚠️  ISSUE FOUND: availableStockFromBalance is 0!');
      console.log('   This means either:');
      console.log('   1. No inventory balances exist for this SKU');
      console.log('   2. All stock is reserved');
      console.log('   3. There\'s an issue with the balance calculation');
    } else {
      console.log('\n✅ Expected value looks correct. Issue might be elsewhere.');
    }
    
  } catch (error) {
    console.error('❌ Debug Error:', error);
  }
}

// Check if we're in a Node.js environment with proper env vars
if (typeof process !== 'undefined' && process.env) {
  debugForecastData();
} else {
  console.log('⚠️  This script needs to be run in a Node.js environment with Supabase credentials');
  console.log('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
}